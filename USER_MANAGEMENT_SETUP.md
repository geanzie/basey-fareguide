# User Management Setup Guide

## Creating Initial Admin and Authority Users

### Method 1: Using the Setup Script (Recommended)

1. **Run the initial user creation script:**
   ```bash
   cd frontend
   node scripts/create-initial-users.js
   ```

   This script will create:
   - **Admin User**: `admin@basey-fareguide.com` / `admin123`
   - **Data Encoder**: `encoder@basey-fareguide.com` / `encoder123`  
   - **Traffic Enforcer**: `enforcer@basey-fareguide.com` / `enforcer123`

2. **⚠️ IMPORTANT**: Change these default passwords immediately after first login!

### Method 2: Using the Admin Panel (After having at least one admin)

1. **Login as Admin** using the credentials created in Method 1
2. **Navigate to Admin Panel**: Click "⚙️ Admin" in the navigation menu
3. **Create New Users**: Use the "Create Authority User" tab to add:
   - Data Encoders (`DATA_ENCODER`)
   - Traffic Enforcers (`ENFORCER`)
   - Additional Admins (`ADMIN`)

### Method 3: Using the Database Directly (Advanced)

If you need to manually create an admin user in the database:

1. **Hash a password** (use an online bcrypt generator with 12 rounds)
2. **Insert into the database:**
   ```sql
   INSERT INTO users (
     id, email, username, password, firstName, lastName, 
     phoneNumber, userType, isActive, isVerified, verifiedAt, 
     createdAt, updatedAt
   ) VALUES (
     'cuid_generated_id',
     'your-admin@email.com',
     'admin',
     'your_hashed_password_here',
     'Your First Name',
     'Your Last Name',
     '+63-XXX-XXX-XXXX',
     'ADMIN',
     true,
     true,
     NOW(),
     NOW(),
     NOW()
   );
   ```

## User Types and Permissions

### ADMIN
- **Access**: Full system access
- **Can**: Create/manage all user types, view all data, access admin panel
- **Pages**: `/admin`, `/dashboard`, all features

### DATA_ENCODER  
- **Access**: Permit management system
- **Can**: Add/edit/renew vehicle permits, view permit statistics
- **Pages**: `/encoder`, `/dashboard` (with permit management)

### ENFORCER
- **Access**: Incident reporting and enforcement
- **Can**: Create incidents, view reports, enforcement actions
- **Pages**: `/dashboard` (authority view), incident management

### PUBLIC
- **Access**: Basic fare calculation and reporting
- **Can**: Calculate fares, report incidents
- **Pages**: `/dashboard` (public view), fare calculator

## Seeding Sample Data

### Create Sample Permits (for testing encoder functionality):
```bash
cd frontend
node scripts/seed-permits.js
```

This creates sample permit data for testing the encoder features.

## Security Notes

1. **Change Default Passwords**: All default passwords should be changed immediately
2. **Email Setup**: In production, implement email notifications for user creation
3. **Environment Variables**: Ensure your `.env` file has proper database connection
4. **Password Policy**: Consider implementing stronger password requirements
5. **Session Management**: Users can be deactivated from the admin panel if needed

## Troubleshooting

### Common Issues:

1. **"User already exists" error**: Check if users were already created previously
2. **Database connection errors**: Verify your `DATABASE_URL` in `.env`
3. **Prisma client errors**: Run `npx prisma generate` to update the client
4. **Permission denied**: Ensure the database user has proper permissions

### Reset Admin Access:

If you lose admin access, you can:
1. Run the setup script again (it will skip existing users)
2. Manually update the database to set a user as ADMIN
3. Create a new admin user using Method 3 above

## Next Steps

1. **Login** with admin credentials
2. **Create encoder users** for your municipality staff
3. **Test permit management** with the encoder account
4. **Set up proper email notifications** for production use
5. **Configure backup procedures** for your permit data