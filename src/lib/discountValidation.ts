/**
 * Discount Application Validation Utilities
 * Shared validation logic for discount card applications
 */

export interface DiscountApplicationData {
  discountType: 'SENIOR_CITIZEN' | 'PWD' | 'STUDENT'
  fullName: string
  dateOfBirth: string
  idNumber?: string
  idType?: string
  issuingAuthority?: string
  schoolName?: string
  schoolAddress?: string
  gradeLevel?: string
  schoolIdExpiry?: string
  disabilityType?: string
  pwdIdExpiry?: string
}

export interface ValidationResult {
  valid: boolean
  errors: string[]
}

/**
 * Validate discount type
 */
export function validateDiscountType(type: string): ValidationResult {
  const validTypes = ['SENIOR_CITIZEN', 'PWD', 'STUDENT']
  
  if (!type) {
    return { valid: false, errors: ['Discount type is required'] }
  }
  
  if (!validTypes.includes(type)) {
    return { 
      valid: false, 
      errors: [`Invalid discount type. Must be one of: ${validTypes.join(', ')}`] 
    }
  }
  
  return { valid: true, errors: [] }
}

/**
 * Validate basic required fields
 */
export function validateBasicFields(data: DiscountApplicationData): ValidationResult {
  const errors: string[] = []
  
  if (!data.fullName || data.fullName.trim().length === 0) {
    errors.push('Full name is required')
  } else if (data.fullName.trim().length < 2) {
    errors.push('Full name must be at least 2 characters')
  } else if (data.fullName.trim().length > 100) {
    errors.push('Full name must not exceed 100 characters')
  }
  
  if (!data.dateOfBirth) {
    errors.push('Date of birth is required')
  } else {
    const birthDate = new Date(data.dateOfBirth)
    const today = new Date()
    
    if (isNaN(birthDate.getTime())) {
      errors.push('Invalid date of birth format')
    } else if (birthDate > today) {
      errors.push('Date of birth cannot be in the future')
    } else {
      const age = today.getFullYear() - birthDate.getFullYear()
      if (age > 150) {
        errors.push('Invalid date of birth (age exceeds 150 years)')
      }
    }
  }
  
  return { valid: errors.length === 0, errors }
}

/**
 * Calculate age from date of birth
 */
export function calculateAge(dateOfBirth: string): number {
  const birthDate = new Date(dateOfBirth)
  const today = new Date()
  let age = today.getFullYear() - birthDate.getFullYear()
  const monthDiff = today.getMonth() - birthDate.getMonth()
  
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
    age--
  }
  
  return age
}

/**
 * Validate Senior Citizen specific requirements
 */
export function validateSeniorCitizen(data: DiscountApplicationData): ValidationResult {
  const errors: string[] = []
  
  if (!data.dateOfBirth) {
    errors.push('Date of birth is required for Senior Citizen discount')
    return { valid: false, errors }
  }
  
  const age = calculateAge(data.dateOfBirth)
  
  if (age < 60) {
    errors.push(`You must be 60 years or older to apply for Senior Citizen discount (current age: ${age})`)
  }
  
  return { valid: errors.length === 0, errors }
}

/**
 * Validate PWD specific requirements
 */
export function validatePWD(data: DiscountApplicationData): ValidationResult {
  const errors: string[] = []
  
  if (!data.disabilityType || data.disabilityType.trim().length === 0) {
    errors.push('Disability type is required for PWD discount')
  }
  
  if (!data.pwdIdExpiry) {
    errors.push('PWD ID expiry date is required')
  } else {
    const expiryDate = new Date(data.pwdIdExpiry)
    const today = new Date()
    
    if (isNaN(expiryDate.getTime())) {
      errors.push('Invalid PWD ID expiry date format')
    } else if (expiryDate < today) {
      errors.push('PWD ID has expired. Please renew your ID before applying')
    }
  }
  
  if (!data.idNumber || data.idNumber.trim().length === 0) {
    errors.push('PWD ID number is required')
  }
  
  return { valid: errors.length === 0, errors }
}

/**
 * Validate Student specific requirements
 */
export function validateStudent(data: DiscountApplicationData): ValidationResult {
  const errors: string[] = []
  
  if (!data.schoolName || data.schoolName.trim().length === 0) {
    errors.push('School name is required for Student discount')
  }
  
  if (!data.gradeLevel || data.gradeLevel.trim().length === 0) {
    errors.push('Grade/Year level is required for Student discount')
  }
  
  if (!data.schoolIdExpiry) {
    errors.push('School ID expiry date is required')
  } else {
    const expiryDate = new Date(data.schoolIdExpiry)
    const today = new Date()
    
    if (isNaN(expiryDate.getTime())) {
      errors.push('Invalid school ID expiry date format')
    } else if (expiryDate < today) {
      errors.push('School ID has expired. Please provide a valid school ID')
    }
  }
  
  return { valid: errors.length === 0, errors }
}

/**
 * Validate file upload
 */
export function validatePhoto(file: File): ValidationResult {
  const errors: string[] = []
  
  if (!file) {
    errors.push('Photo is required')
    return { valid: false, errors }
  }
  
  // Check file type
  const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif']
  if (!validTypes.includes(file.type)) {
    errors.push(`Invalid file type. Accepted formats: JPEG, PNG, GIF`)
  }
  
  // Check file size (5MB limit)
  const maxSize = 5 * 1024 * 1024
  if (file.size > maxSize) {
    errors.push(`File size too large. Maximum size is 5MB (current: ${(file.size / 1024 / 1024).toFixed(2)}MB)`)
  }
  
  // Check minimum size (to avoid tiny/corrupted files)
  const minSize = 1024 // 1KB
  if (file.size < minSize) {
    errors.push('File is too small. Please upload a valid image')
  }
  
  return { valid: errors.length === 0, errors }
}

/**
 * Complete validation for discount application
 */
export function validateDiscountApplication(
  data: DiscountApplicationData,
  photoFile?: File
): ValidationResult {
  const allErrors: string[] = []
  
  // Validate discount type
  const typeValidation = validateDiscountType(data.discountType)
  if (!typeValidation.valid) {
    allErrors.push(...typeValidation.errors)
    return { valid: false, errors: allErrors }
  }
  
  // Validate basic fields
  const basicValidation = validateBasicFields(data)
  allErrors.push(...basicValidation.errors)
  
  // Validate photo if provided
  if (photoFile) {
    const photoValidation = validatePhoto(photoFile)
    allErrors.push(...photoValidation.errors)
  }
  
  // Validate type-specific fields
  switch (data.discountType) {
    case 'SENIOR_CITIZEN':
      const seniorValidation = validateSeniorCitizen(data)
      allErrors.push(...seniorValidation.errors)
      break
      
    case 'PWD':
      const pwdValidation = validatePWD(data)
      allErrors.push(...pwdValidation.errors)
      break
      
    case 'STUDENT':
      const studentValidation = validateStudent(data)
      allErrors.push(...studentValidation.errors)
      break
  }
  
  return { valid: allErrors.length === 0, errors: allErrors }
}

/**
 * Sanitize string input
 */
export function sanitizeString(input: string | null | undefined): string | null {
  if (!input) return null
  return input.trim().substring(0, 500) // Limit length
}

/**
 * Format error messages for API response
 */
export function formatValidationErrors(errors: string[]): string {
  if (errors.length === 0) return ''
  if (errors.length === 1) return errors[0]
  return `Validation errors:\n${errors.map((e, i) => `${i + 1}. ${e}`).join('\n')}`
}
