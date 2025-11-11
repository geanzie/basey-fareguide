# Script to update Prisma after schema changes
# This handles the email field addition to the User model

Write-Host "================================" -ForegroundColor Cyan
Write-Host "Prisma Schema Update Script" -ForegroundColor Cyan
Write-Host "================================" -ForegroundColor Cyan
Write-Host ""

# Step 1: Check if dev server is running
Write-Host "Step 1: Checking for running processes..." -ForegroundColor Yellow
$nodeProcesses = Get-Process node -ErrorAction SilentlyContinue
if ($nodeProcesses) {
    Write-Host "WARNING: Node.js processes are running!" -ForegroundColor Red
    Write-Host "Please stop your dev server (Ctrl+C in the terminal running 'npm run dev')" -ForegroundColor Red
    Write-Host "Then run this script again." -ForegroundColor Red
    Write-Host ""
    Read-Host "Press Enter to exit"
    exit 1
}

Write-Host "✓ No blocking processes found" -ForegroundColor Green
Write-Host ""

# Step 2: Generate Prisma Client
Write-Host "Step 2: Generating Prisma Client..." -ForegroundColor Yellow
try {
    npx prisma generate
    Write-Host "✓ Prisma client generated successfully" -ForegroundColor Green
} catch {
    Write-Host "✗ Failed to generate Prisma client" -ForegroundColor Red
    Write-Host $_.Exception.Message -ForegroundColor Red
    Read-Host "Press Enter to exit"
    exit 1
}
Write-Host ""

# Step 3: Create migration
Write-Host "Step 3: Creating database migration..." -ForegroundColor Yellow
try {
    npx prisma migrate dev --name add_email_field
    Write-Host "✓ Migration created and applied successfully" -ForegroundColor Green
} catch {
    Write-Host "✗ Failed to create migration" -ForegroundColor Red
    Write-Host $_.Exception.Message -ForegroundColor Red
    Read-Host "Press Enter to exit"
    exit 1
}
Write-Host ""

# Step 4: Success message
Write-Host "================================" -ForegroundColor Cyan
Write-Host "✓ All steps completed!" -ForegroundColor Green
Write-Host "================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Next steps:" -ForegroundColor Yellow
Write-Host "1. Start your dev server: npm run dev" -ForegroundColor White
Write-Host "2. Test the password reset feature" -ForegroundColor White
Write-Host ""
Read-Host "Press Enter to exit"
