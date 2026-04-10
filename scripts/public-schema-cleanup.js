const fs = require('fs')
const path = require('path')

const { Client } = require('pg')

const DEFAULT_SCHEMA = 'public'

const SLICES = {
  'legacy-shells-1': {
    description: 'First low-risk slice: empty or superseded legacy shells with no live runtime dependency.',
    tables: [
      'authtoken_token',
      'dispatch_dispatchoffer',
      'dispatch_driveravailability',
      'dispatch_driverlocation',
      'dispatch_driverprofile',
      'dispatch_drivervehicle',
      'dispatch_tripassignment',
      'django_session',
      'trips_cancellation',
      'trips_ratingreview',
      'users_discountusagelog',
      'users_incident',
    ],
  },
  'legacy-blocked-shells-1': {
    description: 'Blocked legacy shells that still have inbound references from retained legacy business tables.',
    tables: [
      'users_discountcard',
      'users_vehicle',
    ],
  },
  'legacy-metadata-unblocked-1': {
    description: 'Second standalone slice: legacy framework metadata and token-blacklist artifacts with no remaining external inbound blockers.',
    tables: [
      'auth_group',
      'auth_group_permissions',
      'auth_permission',
      'django_admin_log',
      'django_content_type',
      'django_migrations',
      'locations_servicearea',
      'token_blacklist_blacklistedtoken',
      'token_blacklist_outstandingtoken',
      'users_user_groups',
      'users_user_user_permissions',
    ],
  },
  'legacy-blocked-metadata-1': {
    description: 'Blocked metadata slice awaiting the retained trips_tripquote dependency decision.',
    tables: [
      'fares_pricingpolicy',
    ],
  },
}

function usage() {
  console.log([
    'Usage:',
    '  node scripts/public-schema-cleanup.js <inspect|export|drop-sql> --slice <slice-name> [--schema public] [--out-dir <dir>]',
    '',
    'Examples:',
    '  node scripts/public-schema-cleanup.js inspect --slice legacy-shells-1',
    '  node scripts/public-schema-cleanup.js export --slice legacy-shells-1 --out-dir artifacts/public-cleanup',
    '  node scripts/public-schema-cleanup.js drop-sql --slice legacy-shells-1 --out-dir artifacts/public-cleanup',
    '',
    'Available slices:',
    ...Object.entries(SLICES).map(([name, slice]) => `  - ${name}: ${slice.description}`),
  ].join('\n'))
}

function parseArgs(argv) {
  const args = {
    mode: argv[2],
    slice: null,
    schema: DEFAULT_SCHEMA,
    outDir: path.join(process.cwd(), 'artifacts', 'public-cleanup'),
  }

  for (let index = 3; index < argv.length; index += 1) {
    const arg = argv[index]

    if (arg === '--slice') {
      args.slice = argv[index + 1]
      index += 1
      continue
    }

    if (arg === '--schema') {
      args.schema = argv[index + 1]
      index += 1
      continue
    }

    if (arg === '--out-dir') {
      args.outDir = path.resolve(argv[index + 1])
      index += 1
      continue
    }

    throw new Error(`Unknown argument: ${arg}`)
  }

  if (!args.mode || !['inspect', 'export', 'drop-sql'].includes(args.mode)) {
    throw new Error('Mode must be one of: inspect, export, drop-sql')
  }

  if (!args.slice) {
    throw new Error('Missing required --slice argument')
  }

  if (!SLICES[args.slice]) {
    throw new Error(`Unknown slice: ${args.slice}`)
  }

  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL is required')
  }

  return args
}

function quoteIdentifier(identifier) {
  return `"${String(identifier).replace(/"/g, '""')}"`
}

function buildQualifiedTableName(schemaName, tableName) {
  return `${quoteIdentifier(schemaName)}.${quoteIdentifier(tableName)}`
}

function topologicalDropOrder(tables, foreignKeys) {
  const tableSet = new Set(tables)
  const edges = new Map(tables.map((table) => [table, new Set()]))
  const inDegree = new Map(tables.map((table) => [table, 0]))

  for (const foreignKey of foreignKeys) {
    if (!tableSet.has(foreignKey.table_name) || !tableSet.has(foreignKey.foreign_table_name)) {
      continue
    }

    const adjacent = edges.get(foreignKey.table_name)
    if (!adjacent.has(foreignKey.foreign_table_name)) {
      adjacent.add(foreignKey.foreign_table_name)
      inDegree.set(foreignKey.foreign_table_name, inDegree.get(foreignKey.foreign_table_name) + 1)
    }
  }

  const queue = tables.filter((table) => inDegree.get(table) === 0)
  const ordered = []

  while (queue.length > 0) {
    const table = queue.shift()
    ordered.push(table)

    for (const neighbor of edges.get(table)) {
      const nextDegree = inDegree.get(neighbor) - 1
      inDegree.set(neighbor, nextDegree)
      if (nextDegree === 0) {
        queue.push(neighbor)
      }
    }
  }

  if (ordered.length !== tables.length) {
    throw new Error('Could not determine drop order because of a cycle in the target slice')
  }

  return ordered
}

async function queryTableRows(client, schemaName, tables) {
  const rows = []

  for (const tableName of tables) {
    const qualifiedTable = buildQualifiedTableName(schemaName, tableName)
    const result = await client.query(`SELECT COUNT(*)::bigint AS row_count FROM ${qualifiedTable}`)
    rows.push({ table_name: tableName, row_count: Number(result.rows[0].row_count) })
  }

  return rows
}

async function queryTableSizes(client, schemaName, tables) {
  const result = await client.query(
    `SELECT c.relname AS table_name, pg_total_relation_size(c.oid)::bigint AS total_size_bytes
     FROM pg_class c
     JOIN pg_namespace n ON n.oid = c.relnamespace
     WHERE n.nspname = $1 AND c.relkind = 'r' AND c.relname = ANY($2::text[])
     ORDER BY c.relname`,
    [schemaName, tables]
  )

  return result.rows.map((row) => ({
    table_name: row.table_name,
    total_size_bytes: Number(row.total_size_bytes),
  }))
}

async function queryColumns(client, schemaName, tables) {
  const result = await client.query(
    `SELECT c.relname AS table_name,
            a.attnum AS ordinal_position,
            a.attname AS column_name,
            format_type(a.atttypid, a.atttypmod) AS formatted_type,
            NOT a.attnotnull AS is_nullable,
            pg_get_expr(ad.adbin, ad.adrelid) AS default_expression
     FROM pg_attribute a
     JOIN pg_class c ON c.oid = a.attrelid
     JOIN pg_namespace n ON n.oid = c.relnamespace
     LEFT JOIN pg_attrdef ad ON ad.adrelid = a.attrelid AND ad.adnum = a.attnum
     WHERE n.nspname = $1 AND c.relname = ANY($2::text[]) AND a.attnum > 0 AND NOT a.attisdropped
     ORDER BY c.relname, a.attnum`,
    [schemaName, tables]
  )

  return result.rows
}

async function queryConstraints(client, schemaName, tables) {
  const result = await client.query(
    `SELECT c.relname AS table_name,
            con.conname AS constraint_name,
            con.contype AS constraint_type,
            pg_get_constraintdef(con.oid, true) AS definition
     FROM pg_constraint con
     JOIN pg_class c ON c.oid = con.conrelid
     JOIN pg_namespace n ON n.oid = c.relnamespace
     WHERE n.nspname = $1 AND c.relname = ANY($2::text[])
     ORDER BY c.relname, con.conname`,
    [schemaName, tables]
  )

  return result.rows
}

async function queryIndexes(client, schemaName, tables) {
  const result = await client.query(
    `SELECT tablename AS table_name, indexname AS index_name, indexdef AS index_definition
     FROM pg_indexes
     WHERE schemaname = $1 AND tablename = ANY($2::text[])
     ORDER BY tablename, indexname`,
    [schemaName, tables]
  )

  return result.rows
}

async function queryOutboundForeignKeys(client, schemaName, tables) {
  const result = await client.query(
    `SELECT tc.table_name,
            kcu.column_name,
            ccu.table_schema AS foreign_table_schema,
            ccu.table_name AS foreign_table_name,
            ccu.column_name AS foreign_column_name,
            tc.constraint_name
     FROM information_schema.table_constraints tc
     JOIN information_schema.key_column_usage kcu
       ON tc.constraint_name = kcu.constraint_name
      AND tc.table_schema = kcu.table_schema
     JOIN information_schema.constraint_column_usage ccu
       ON ccu.constraint_name = tc.constraint_name
      AND ccu.table_schema = tc.table_schema
     WHERE tc.constraint_type = 'FOREIGN KEY'
       AND tc.table_schema = $1
       AND tc.table_name = ANY($2::text[])
     ORDER BY tc.table_name, tc.constraint_name`,
    [schemaName, tables]
  )

  return result.rows
}

async function queryInboundForeignKeys(client, schemaName, tables) {
  const result = await client.query(
    `SELECT tc.table_schema AS dependent_schema,
            tc.table_name AS dependent_table,
            kcu.column_name AS dependent_column,
            ccu.table_name AS referenced_table,
            ccu.column_name AS referenced_column,
            tc.constraint_name
     FROM information_schema.table_constraints tc
     JOIN information_schema.key_column_usage kcu
       ON tc.constraint_name = kcu.constraint_name
      AND tc.table_schema = kcu.table_schema
     JOIN information_schema.constraint_column_usage ccu
       ON ccu.constraint_name = tc.constraint_name
      AND ccu.table_schema = tc.table_schema
     WHERE tc.constraint_type = 'FOREIGN KEY'
       AND ccu.table_schema = $1
       AND ccu.table_name = ANY($2::text[])
     ORDER BY tc.table_schema, tc.table_name, tc.constraint_name`,
    [schemaName, tables]
  )

  return result.rows
}

async function exportTableData(client, schemaName, tables, outputDirectory) {
  const dataDirectory = path.join(outputDirectory, 'data')
  fs.mkdirSync(dataDirectory, { recursive: true })

  for (const tableName of tables) {
    const qualifiedTable = buildQualifiedTableName(schemaName, tableName)
    const result = await client.query(`SELECT row_to_json(t) AS row FROM ${qualifiedTable} t`)
    const outputPath = path.join(dataDirectory, `${tableName}.json`)
    fs.writeFileSync(outputPath, JSON.stringify(result.rows.map((row) => row.row), null, 2))
  }
}

function ensureDirectory(directoryPath) {
  fs.mkdirSync(directoryPath, { recursive: true })
}

function summarize(report) {
  const rowTotal = report.tables.reduce((sum, table) => sum + table.row_count, 0)
  const sizeTotal = report.tables.reduce((sum, table) => sum + table.total_size_bytes, 0)
  const externalBlockers = report.inboundForeignKeys.filter(
    (foreignKey) => !report.slice.tables.includes(foreignKey.dependent_table)
  )

  return {
    slice: report.slice.name,
    schema: report.schema,
    tableCount: report.tables.length,
    totalRows: rowTotal,
    totalSizeBytes: sizeTotal,
    externalInboundForeignKeyCount: externalBlockers.length,
    dropOrder: report.dropOrder,
  }
}

function buildDropSql(schemaName, orderedTables) {
  const statements = [
    '-- Generated by scripts/public-schema-cleanup.js',
    '-- Review before execution. This file intentionally avoids CASCADE.',
    'BEGIN;',
    ...orderedTables.map((tableName) => `DROP TABLE IF EXISTS ${buildQualifiedTableName(schemaName, tableName)};`),
    'COMMIT;',
    '',
  ]

  return statements.join('\n')
}

async function buildReport(client, args) {
  const slice = SLICES[args.slice]
  const tables = [...slice.tables].sort()

  const rows = await queryTableRows(client, args.schema, tables)
  const sizes = await queryTableSizes(client, args.schema, tables)
  const columns = await queryColumns(client, args.schema, tables)
  const constraints = await queryConstraints(client, args.schema, tables)
  const indexes = await queryIndexes(client, args.schema, tables)
  const outboundForeignKeys = await queryOutboundForeignKeys(client, args.schema, tables)
  const inboundForeignKeys = await queryInboundForeignKeys(client, args.schema, tables)

  const rowMap = new Map(rows.map((row) => [row.table_name, row.row_count]))
  const sizeMap = new Map(sizes.map((size) => [size.table_name, size.total_size_bytes]))
  const dropOrder = topologicalDropOrder(tables, outboundForeignKeys)

  return {
    generatedAt: new Date().toISOString(),
    schema: args.schema,
    slice: {
      name: args.slice,
      description: slice.description,
      tables,
    },
    tables: tables.map((tableName) => ({
      table_name: tableName,
      row_count: rowMap.get(tableName) ?? 0,
      total_size_bytes: sizeMap.get(tableName) ?? 0,
    })),
    columns,
    constraints,
    indexes,
    outboundForeignKeys,
    inboundForeignKeys,
    dropOrder,
  }
}

async function main() {
  const args = parseArgs(process.argv)
  const client = new Client({ connectionString: process.env.DATABASE_URL })

  await client.connect()

  try {
    const report = await buildReport(client, args)
    const summary = summarize(report)
    const timestamp = summary.generatedAt || new Date().toISOString().replace(/[:.]/g, '-')
    const baseOutputDirectory = path.join(args.outDir, args.slice)

    if (args.mode === 'inspect') {
      console.log(JSON.stringify({ summary, report }, null, 2))
      return
    }

    ensureDirectory(baseOutputDirectory)

    const reportPath = path.join(baseOutputDirectory, 'report.json')
    fs.writeFileSync(reportPath, JSON.stringify({ summary, report }, null, 2))

    if (args.mode === 'export' || args.mode === 'drop-sql') {
      await exportTableData(client, args.schema, report.slice.tables, baseOutputDirectory)
      fs.writeFileSync(path.join(baseOutputDirectory, 'README.txt'), [
        `Slice: ${args.slice}`,
        `Schema: ${args.schema}`,
        `Generated at: ${report.generatedAt}`,
        '',
        'Artifacts:',
        '- report.json contains row counts, sizes, columns, constraints, indexes, and dependency evidence.',
        '- data/*.json contains raw row exports for each table.',
        '',
        'Note:',
        'pg_dump is not available in this environment, so this export is JSON-plus-metadata rather than a native PostgreSQL dump.',
        'Use a Neon branch or clone as the primary rollback path when executing destructive cleanup.',
        '',
      ].join('\n'))
    }

    if (args.mode === 'drop-sql') {
      fs.writeFileSync(path.join(baseOutputDirectory, 'drop.sql'), buildDropSql(args.schema, report.dropOrder))
    }

    console.log(JSON.stringify({ summary, outputDirectory: baseOutputDirectory }, null, 2))
  } finally {
    await client.end()
  }
}

main().catch((error) => {
  console.error(error.message)
  usage()
  process.exit(1)
})