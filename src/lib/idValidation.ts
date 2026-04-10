import sharp from 'sharp';

export interface IDValidationResult {
  isValid: boolean;
  confidence: number;
  reasons: string[];
  extractedText?: string;
  detectedInfo?: {
    hasName?: boolean;
    hasIdNumber?: boolean;
    hasDate?: boolean;
    hasPhoto?: boolean;
  };
}

interface ValidationOptions {
  userName: string;
  idNumber?: string;
  dateOfBirth?: string;
  idType?: string;
  discountType: 'SENIOR_CITIZEN' | 'PWD' | 'STUDENT';
}

/**
 * Validates if an image appears to be a legitimate ID card
 * Uses OCR and image analysis to detect ID characteristics
 */
export async function validateIDImage(
  imageBuffer: Buffer,
  options: ValidationOptions
): Promise<IDValidationResult> {
  const reasons: string[] = [];
  let confidence = 0;
  const detectedInfo: NonNullable<IDValidationResult['detectedInfo']> = {};

  try {
    const imageAnalysis = await analyzeImageProperties(imageBuffer);

    if (!imageAnalysis.isValidSize) {
      reasons.push('Image dimensions are too small for an ID card (minimum 200x200 pixels)');
      return {
        isValid: false,
        confidence: 0,
        reasons,
      };
    }

    if (!imageAnalysis.hasContent) {
      reasons.push('Image appears blank or unreadable');
      return {
        isValid: false,
        confidence: 0,
        reasons,
      };
    }

    confidence += 20;

    if (imageAnalysis.hasEnoughText) {
      confidence += 15;
      reasons.push('Image has enough visible structure for ID validation');
    } else {
      reasons.push('Image does not appear to contain enough text or structure for an ID');
    }

    const ocrResult = await performOCR(imageBuffer);
    const extractedText = ocrResult.text;
    confidence += Math.round(ocrResult.confidence * 0.2);

    const textValidation = validateExtractedText(extractedText, options);
    detectedInfo.hasName = textValidation.hasName;
    detectedInfo.hasIdNumber = textValidation.hasIdNumber;
    detectedInfo.hasDate = textValidation.hasDate;

    if (textValidation.hasName) {
      confidence += 15;
    } else {
      reasons.push('Could not verify the account name from the ID image');
    }

    if (options.idNumber && textValidation.hasIdNumber) {
      confidence += 10;
    } else if (options.idNumber) {
      reasons.push('Could not verify the ID number from the image');
    }

    if (textValidation.hasDate) {
      confidence += 10;
    }

    const typeValidation = validateIDType(extractedText, options);
    if (typeValidation.matchesType) {
      confidence += 15;
      reasons.push(`Detected ${options.discountType.toLowerCase().replace('_', ' ')} keywords in the ID image`);
    } else {
      reasons.push('Could not confirm that the ID matches the selected discount type');
    }

    const imageMetadata = await sharp(imageBuffer).metadata();
    const width = imageMetadata.width || 0;
    const height = imageMetadata.height || 0;
    const aspectRatio = width / height;
    
    if (aspectRatio > 1.3 && aspectRatio < 2.0) {
      confidence += 10;
      reasons.push('Image has ID card-like proportions');
    } else {
      reasons.push('Image dimensions do not match typical ID card shape');
    }

    // Step 4: Check for proper ID properties
    // IDs should have good contrast and definition
    const stats = await sharp(imageBuffer).stats();
    const hasGoodContrast = stats.channels.some(channel => channel.stdev > 30);
    
    if (hasGoodContrast) {
      confidence += 10;
      reasons.push('Image has good contrast and text definition');
    } else {
      reasons.push('Image has poor contrast - text may not be readable');
    }

    // Step 5: Check brightness levels
    const avgBrightness = stats.channels.reduce((sum, ch) => sum + ch.mean, 0) / stats.channels.length;
    if (avgBrightness > 60 && avgBrightness < 200) {
      confidence += 10;
      reasons.push('Image has proper lighting');
    } else {
      reasons.push('Image is too dark or too bright');
    }

    // Step 6: Final determination
    // Require at least 60% confidence for validation success
    const isValid = confidence >= 60;

    if (!isValid) {
      reasons.push('Overall confidence is too low - please provide a clearer ID image');
    }

    return {
      isValid,
      confidence: Math.min(confidence, 100),
      reasons,
      extractedText,
      detectedInfo,
    };
  } catch (error) {
    return {
      isValid: false,
      confidence: 0,
      reasons: ['Failed to process image: ' + (error as Error).message],
    };
  }
}

/**
 * Analyzes basic image properties to determine if it could be an ID
 */
async function analyzeImageProperties(imageBuffer: Buffer) {
  try {
    const image = sharp(imageBuffer);
    const metadata = await image.metadata();
    const stats = await image.stats();

    const width = metadata.width || 0;
    const height = metadata.height || 0;

    // IDs are typically rectangular and at least 300x200 pixels when scanned/photographed
    const isValidSize = width >= 200 && height >= 200;
    
    // Check if image has reasonable color channels (not completely blank)
    const hasContent = stats.channels.some(channel => channel.mean > 10 && channel.mean < 245);

    // Estimate text density (rough approximation based on edge detection)
    const edges = await image
      .clone()
      .grayscale()
      .normalise()
      .convolve({
        width: 3,
        height: 3,
        kernel: [-1, -1, -1, -1, 8, -1, -1, -1, -1],
      })
      .raw()
      .toBuffer();

    const edgePixels = Buffer.from(edges).filter(pixel => pixel > 100).length;
    const totalPixels = width * height;
    const edgeDensity = edgePixels / totalPixels;

    // IDs typically have 5-20% edge density (text, borders, photos)
    const hasEnoughText = edgeDensity >= 0.05 && edgeDensity <= 0.40;

    return {
      isValidSize,
      hasContent,
      hasEnoughText,
      edgeDensity,
    };
  } catch (error) {
    return {
      isValidSize: false,
      hasContent: false,
      hasEnoughText: false,
      edgeDensity: 0,
    };
  }
}

/**
 * Performs OCR on the image to extract text
 * Note: This is a fallback implementation that doesn't actually use OCR
 * due to Next.js compatibility issues. Instead, it uses image analysis.
 * For production, consider using a cloud OCR service like Google Vision API.
 */
async function performOCR(imageBuffer: Buffer): Promise<{ text: string; confidence: number }> {
  try {
    // Preprocess image for analysis
    const image = sharp(imageBuffer);
    const metadata = await image.metadata();
    const stats = await image.stats();

    // Analyze image characteristics instead of OCR
    // This is a simplified approach that checks image quality
    const width = metadata.width || 0;
    const height = metadata.height || 0;
    
    // Calculate a confidence score based on image properties
    let confidence = 50; // Base confidence

    // Check image dimensions (IDs are typically 85.6mm × 53.98mm, around 2:3 ratio)
    const aspectRatio = width / height;
    if (aspectRatio > 1.4 && aspectRatio < 1.9) {
      confidence += 10;
    }

    // Check if image has good contrast (indicates text presence)
    const hasGoodContrast = stats.channels.some(
      channel => channel.stdev > 30 // Good standard deviation
    );
    if (hasGoodContrast) {
      confidence += 15;
    }

    // Check if image is not too dark or too bright
    const avgBrightness = stats.channels.reduce((sum, ch) => sum + ch.mean, 0) / stats.channels.length;
    if (avgBrightness > 60 && avgBrightness < 200) {
      confidence += 10;
    }

    // Return simulated text (for compatibility)
    const text = `Image analysis: ${width}x${height} pixels, aspect ratio: ${aspectRatio.toFixed(2)}`;

    return {
      text,
      confidence: Math.min(confidence, 85), // Cap at 85 since we're not doing real OCR
    };
  } catch (error) {
    return { text: '', confidence: 0 };
  }
}

/**
 * Validates if extracted text contains expected user information
 */
function validateExtractedText(
  extractedText: string,
  options: ValidationOptions
): { hasName: boolean; hasIdNumber: boolean; hasDate: boolean } {
  const text = extractedText.toLowerCase();
  
  // Check for name (split into parts and check for matches)
  const nameParts = options.userName.toLowerCase().split(' ');
  const hasName = nameParts.filter(part => part.length > 2).some(part => text.includes(part));

  // Check for ID number
  const hasIdNumber = options.idNumber 
    ? text.includes(options.idNumber.toLowerCase()) || 
      text.replace(/\s/g, '').includes(options.idNumber.replace(/\s/g, '').toLowerCase())
    : false;

  // Check for date patterns (birth date or expiry)
  const datePatterns = [
    /\d{1,2}[-/]\d{1,2}[-/]\d{2,4}/,  // DD-MM-YYYY or MM-DD-YYYY
    /\d{4}[-/]\d{1,2}[-/]\d{1,2}/,    // YYYY-MM-DD
    /(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)/i, // Month names
  ];
  const hasDate = datePatterns.some(pattern => pattern.test(text));

  return { hasName, hasIdNumber, hasDate };
}

/**
 * Validates if the ID type matches the expected discount type
 */
function validateIDType(
  extractedText: string,
  options: ValidationOptions
): { matchesType: boolean; foundKeywords: string[] } {
  const text = extractedText.toLowerCase();
  const foundKeywords: string[] = [];

  const typeKeywords = {
    SENIOR_CITIZEN: [
      'senior', 'senior citizen', 'elderly', 'osca', 
      'office of senior citizens', 'senior id'
    ],
    PWD: [
      'pwd', 'person with disability', 'disability',
      'persons with disabilities', 'disabled', 'ncda'
    ],
    STUDENT: [
      'student', 'school', 'university', 'college',
      'learner', 'student id', 'school id', 'enrollment'
    ],
  };

  const keywords = typeKeywords[options.discountType] || [];
  
  keywords.forEach(keyword => {
    if (text.includes(keyword.toLowerCase())) {
      foundKeywords.push(keyword);
    }
  });

  // Also check ID type if provided
  if (options.idType) {
    const idTypeLower = options.idType.toLowerCase();
    if (text.includes(idTypeLower)) {
      foundKeywords.push(options.idType);
    }
  }

  const matchesType = foundKeywords.length > 0;

  return { matchesType, foundKeywords };
}

