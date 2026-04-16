import { UserType } from '@prisma/client'
import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { buildPaginationMetadata, parsePaginationParams } from '@/lib/api/pagination'
import { ADMIN_ONLY, requireRequestRole } from '@/lib/auth'
import { toAdminUserDto, type AdminUsersListData } from '@/lib/admin/user-management-contract'
import { createAdminRouteAuthError, createAdminRouteSuccess } from '@/lib/admin/user-management-route'

export async function GET(request: NextRequest) {
  try {
    await requireRequestRole(request, [...ADMIN_ONLY])
    const { searchParams } = new URL(request.url)
    const pagination = parsePaginationParams(searchParams, {
      defaultLimit: 50,
      maxLimit: 100,
    })

    const search = searchParams.get('search')?.trim() || ''
    const userType = searchParams.get('userType')?.trim() || 'all'
    const status = searchParams.get('status')?.trim() || 'all'
    const creationSource = searchParams.get('creationSource')?.trim() || 'all'

    const where = {
      ...(search
        ? {
            OR: [
              { firstName: { contains: search, mode: 'insensitive' as const } },
              { lastName: { contains: search, mode: 'insensitive' as const } },
              { username: { contains: search, mode: 'insensitive' as const } },
              { phoneNumber: { contains: search, mode: 'insensitive' as const } },
              { governmentId: { contains: search, mode: 'insensitive' as const } },
              { barangayResidence: { contains: search, mode: 'insensitive' as const } },
              { assignedVehicle: { is: { plateNumber: { contains: search, mode: 'insensitive' as const } } } },
            ],
          }
        : {}),
      ...(userType !== 'all' && (Object.values(UserType) as string[]).includes(userType)
        ? { userType: userType as UserType }
        : {}),
      ...(status === 'active' ? { isActive: true } : {}),
      ...(status === 'inactive' ? { isActive: false } : {}),
      ...(creationSource === 'ADMIN_CREATED'
        ? { userType: { not: 'PUBLIC' as const } }
        : creationSource === 'SELF_REGISTERED'
          ? { userType: 'PUBLIC' as const }
          : {}),
    }

    const [users, filteredTotal, totalUsers, activeUsers, publicUsers, usersByType] = await Promise.all([
      prisma.user.findMany({
        where,
        select: {
          id: true,
          firstName: true,
          lastName: true,
          username: true,
          userType: true,
          isActive: true,
          createdAt: true,
          governmentId: true,
          barangayResidence: true,
          reasonForRegistration: true,
          phoneNumber: true,
          assignedVehicle: {
            select: {
              id: true,
              plateNumber: true,
              vehicleType: true,
              permit: {
                select: {
                  permitPlateNumber: true,
                },
              },
            },
          },
        },
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        skip: pagination.skip,
        take: pagination.limit,
      }),
      prisma.user.count({ where }),
      prisma.user.count(),
      prisma.user.count({ where: { isActive: true } }),
      prisma.user.count({ where: { userType: 'PUBLIC' as const } }),
      prisma.user.groupBy({
        by: ['userType'],
        _count: {
          _all: true,
        },
      }),
    ])

    const byType = Object.fromEntries(
      usersByType.map((group) => [group.userType, group._count._all]),
    )

    const data: AdminUsersListData = {
      users: users.map(toAdminUserDto),
      pagination: buildPaginationMetadata(pagination, filteredTotal),
      summary: {
        total: totalUsers,
        active: activeUsers,
        inactive: totalUsers - activeUsers,
        adminCreated: totalUsers - publicUsers,
        selfRegistered: publicUsers,
        byType,
      },
    }

    return createAdminRouteSuccess(data)
  } catch (error) {
    return createAdminRouteAuthError(error)
  }
}
