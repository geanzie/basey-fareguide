import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

export async function POST(request: NextRequest) {
  try {
    const {
      firstName,
      lastName,
      email,
      phoneNumber,
      userType,
      department,
      position,
      employeeId,
      notes
    } = await request.json();

    // Check if user already exists
    const existingUser = await prisma.user.findFirst({
      where: {
        OR: [
          { email },
          { username: email.split('@')[0] }
        ]
      }
    });

    if (existingUser) {
      return NextResponse.json({
        success: false,
        error: 'User with this email already exists'
      });
    }

    // Generate temporary password
    const tempPassword = `Temp${Math.random().toString(36).slice(-8)}!`;
    const hashedPassword = await bcrypt.hash(tempPassword, 10);

    // Create user
    const newUser = await prisma.user.create({
      data: {
        email,
        username: email.split('@')[0],
        password: hashedPassword,
        firstName,
        lastName,
        phoneNumber,
        userType,
        isActive: true,
        isVerified: true, // Official accounts are pre-verified
        verifiedAt: new Date(),
        verifiedBy: 'SYSTEM_ADMIN' // In real app, use actual admin ID
      }
    });

    // Log the admin user creation
    await prisma.adminUserCreation.create({
      data: {
        requestedBy: 'SYSTEM_ADMIN', // In real app, use actual admin ID
        userType,
        firstName,
        lastName,
        email,
        phoneNumber,
        department,
        position,
        employeeId,
        notes,
        isActive: true,
        approvedBy: 'SYSTEM_ADMIN',
        approvedAt: new Date(),
        createdUserId: newUser.id
      }
    });

    // Create verification log
    await prisma.userVerificationLog.create({
      data: {
        userId: newUser.id,
        action: 'CREATED',
        performedBy: 'SYSTEM_ADMIN',
        reason: 'Official account created by administrator',
        evidence: JSON.stringify({
          userType,
          department,
          position,
          employeeId,
          createdBy: 'admin'
        })
      }
    });

    return NextResponse.json({
      success: true,
      message: 'User created successfully',
      tempPassword, // Send temp password to admin (in real app, send via email)
      user: {
        id: newUser.id,
        email: newUser.email,
        firstName: newUser.firstName,
        lastName: newUser.lastName,
        userType: newUser.userType
      }
    });

  } catch (error) {
    console.error('Error creating user:', error);
    return NextResponse.json({
      success: false,
      error: 'Failed to create user'
    }, { status: 500 });
  }
}