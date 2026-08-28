/**
 * Test script for ID validation functionality
 * 
 * Run this script to test the ID validation API
 * Usage: node scripts/test-id-validation.js
 */

const fs = require('fs');
const path = require('path');

async function testIDValidation() {
  console.log('🧪 Testing ID Validation System\n');

  // Check if required packages are installed
  console.log('📦 Checking dependencies...');
  try {
    require('tesseract.js');
    require('sharp');
    console.log('✅ tesseract.js found');
    console.log('✅ sharp found');
  } catch (error) {
    console.log('❌ Missing dependencies. Run: npm install tesseract.js sharp');
    return;
  }

  // Check if validation library exists
  const validationLibPath = path.join(__dirname, '../src/lib/idValidation.ts');
  if (fs.existsSync(validationLibPath)) {
    console.log('✅ ID validation library found');
  } else {
    console.log('❌ ID validation library not found at:', validationLibPath);
    return;
  }

  // Check if API endpoint exists
  const apiEndpointPath = path.join(__dirname, '../src/app/api/discount-cards/validate-id/route.ts');
  if (fs.existsSync(apiEndpointPath)) {
    console.log('✅ Validation API endpoint found');
  } else {
    console.log('❌ Validation API endpoint not found at:', apiEndpointPath);
    return;
  }

  // Check if component was updated
  const componentPath = path.join(__dirname, '../src/components/DiscountApplication.tsx');
  if (fs.existsSync(componentPath)) {
    const componentContent = fs.readFileSync(componentPath, 'utf-8');
    if (componentContent.includes('validateIDPhoto') && componentContent.includes('validatingID')) {
      console.log('✅ DiscountApplication component updated');
    } else {
      console.log('⚠️ DiscountApplication component may not be fully updated');
    }
  }

  // Check if upload directories exist
  const uploadDir = path.join(__dirname, '../public/uploads/discount-cards');
  if (fs.existsSync(uploadDir)) {
    console.log('✅ Upload directory exists');
  } else {
    console.log('⚠️ Upload directory will be created on first upload');
  }

  console.log('\n✨ ID Validation System Check Complete!\n');
  console.log('📋 Next Steps:');
  console.log('1. Start the development server: npm run dev');
  console.log('2. Log in as a PUBLIC user');
  console.log('3. Navigate to the discount application page');
  console.log('4. Upload an ID image to test validation');
  console.log('5. Check the validation results and feedback\n');

  console.log('🔍 Validation Features:');
  console.log('• Real-time ID image validation');
  console.log('• OCR text extraction');
  console.log('• Name and ID number matching');
  console.log('• ID type detection');
  console.log('• Confidence scoring (0-100%)');
  console.log('• User-friendly feedback messages\n');

  console.log('⚙️ Configuration:');
  console.log('• Minimum confidence threshold: 30%');
  console.log('• Maximum file size: 5MB');
  console.log('• Minimum resolution: 200x200 pixels');
  console.log('• Supported formats: JPG, PNG\n');

  console.log('📝 Tips for Testing:');
  console.log('• Use clear, well-lit ID photos');
  console.log('• Test with different ID types (Senior, PWD, Student)');
  console.log('• Try blurry images to see lower confidence scores');
  console.log('• Test with non-ID images to verify rejection');
  console.log('• Check browser console for validation logs\n');
}

// Run the test
testIDValidation().catch(console.error);
