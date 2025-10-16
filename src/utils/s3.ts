import { S3Client, PutObjectCommand, DeleteObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import crypto from 'crypto';
import path from 'path';

// Configure S3 client - we'll create it dynamically to ensure env vars are loaded
const createS3Client = () => {
  const accessKeyId = process.env.AWS_ACCESS_KEY_ID;
  const secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY;
  const region = process.env.AWS_REGION || 'us-east-1';
  
  console.log('🔧 Creating S3 Client with:');
  console.log('Region:', region);
  console.log('Access Key ID:', accessKeyId ? `${accessKeyId.substring(0, 4)}...${accessKeyId.substring(accessKeyId.length - 4)}` : 'MISSING');
  console.log('Secret Access Key:', secretAccessKey ? `${secretAccessKey.substring(0, 4)}...${secretAccessKey.substring(secretAccessKey.length - 4)}` : 'MISSING');
  
  if (!accessKeyId || !secretAccessKey) {
    throw new Error('AWS credentials are missing or empty');
  }
  
  return new S3Client({
    region,
    credentials: {
      accessKeyId,
      secretAccessKey,
    },
  });
};

// Remove these constants - we'll access env vars directly in methods

export class S3Service {
  /**
   * Upload a file to S3
   */
  static async uploadFile(
    file: Express.Multer.File,
    folder: string = process.env.AWS_S3_AVATARS_FOLDER || 'avatars'
  ): Promise<string> {
    const bucketName = process.env.AWS_S3_BUCKET_NAME;
    console.log('🔍 Runtime S3 Check:');
    console.log('AWS_S3_BUCKET_NAME at runtime:', bucketName);
    console.log('All env vars:', {
      AWS_ACCESS_KEY_ID: process.env.AWS_ACCESS_KEY_ID ? 'Set' : 'Missing',
      AWS_SECRET_ACCESS_KEY: process.env.AWS_SECRET_ACCESS_KEY ? 'Set' : 'Missing',
      AWS_REGION: process.env.AWS_REGION,
      AWS_S3_BUCKET_NAME: process.env.AWS_S3_BUCKET_NAME
    });
    
    if (!bucketName) {
      throw new Error('AWS S3 bucket name is not configured');
    }

    // Generate unique filename
    const fileExtension = path.extname(file.originalname);
    const uniqueFilename = `${folder}/${crypto.randomUUID()}${fileExtension}`;

    const uploadParams = {
      Bucket: bucketName,
      Key: uniqueFilename,
      Body: file.buffer,
      ContentType: file.mimetype,
      ContentDisposition: 'inline',
      CacheControl: 'max-age=31536000', // 1 year cache
    };

    try {
      console.log(`📤 Uploading to S3: ${uniqueFilename}`);
      console.log(`📍 Bucket: ${bucketName}, Region: ${process.env.AWS_REGION}`);
      
      const s3Client = createS3Client();
      const command = new PutObjectCommand(uploadParams);
      await s3Client.send(command);

      // Return the full S3 URL
      const s3Url = `https://${bucketName}.s3.${process.env.AWS_REGION}.amazonaws.com/${uniqueFilename}`;
      console.log(`✅ Upload successful: ${s3Url}`);
      return s3Url;
    } catch (error) {
      console.error('❌ S3 upload error:', error);
      throw new Error(`Failed to upload file to S3: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Delete a file from S3
   */
  static async deleteFile(fileUrl: string): Promise<void> {
    const bucketName = process.env.AWS_S3_BUCKET_NAME;
    if (!bucketName) {
      throw new Error('AWS S3 bucket name is not configured');
    }

    try {
      // Extract the key from the S3 URL
      const key = this.extractKeyFromUrl(fileUrl);
      if (!key) {
        throw new Error('Invalid S3 URL format');
      }

      const deleteParams = {
        Bucket: bucketName,
        Key: key,
      };

      const s3Client = createS3Client();
      const command = new DeleteObjectCommand(deleteParams);
      await s3Client.send(command);
    } catch (error) {
      console.error('S3 delete error:', error);
      throw new Error('Failed to delete file from S3');
    }
  }

  /**
   * Generate a presigned URL for temporary access
   */
  static async getPresignedUrl(
    key: string,
    expiresIn: number = 3600
  ): Promise<string> {
    const bucketName = process.env.AWS_S3_BUCKET_NAME;
    if (!bucketName) {
      throw new Error('AWS S3 bucket name is not configured');
    }

    try {
      const s3Client = createS3Client();
      const command = new GetObjectCommand({
        Bucket: bucketName,
        Key: key,
      });

      return await getSignedUrl(s3Client, command, { expiresIn });
    } catch (error) {
      console.error('S3 presigned URL error:', error);
      throw new Error('Failed to generate presigned URL');
    }
  }

  /**
   * Extract S3 key from full S3 URL
   */
  private static extractKeyFromUrl(url: string): string | null {
    try {
      // Handle both path-style and virtual-hosted-style URLs
      const urlObj = new URL(url);
      
      if (urlObj.hostname.includes('.s3.')) {
        // Virtual-hosted-style URL: https://bucket.s3.region.amazonaws.com/key
        return urlObj.pathname.substring(1); // Remove leading slash
      } else if (urlObj.hostname === 's3.amazonaws.com') {
        // Path-style URL: https://s3.amazonaws.com/bucket/key
        const pathParts = urlObj.pathname.split('/');
        return pathParts.slice(2).join('/'); // Remove empty string and bucket name
      }
      
      return null;
    } catch (error) {
      console.error('Error extracting key from URL:', error);
      return null;
    }
  }

  /**
   * Validate S3 configuration
   */
  static validateConfiguration(): boolean {
    const requiredEnvVars = [
      'AWS_ACCESS_KEY_ID',
      'AWS_SECRET_ACCESS_KEY',
      'AWS_REGION',
      'AWS_S3_BUCKET_NAME',
    ];

    console.log('🔍 Checking S3 Configuration:');
    console.log('AWS_ACCESS_KEY_ID:', process.env.AWS_ACCESS_KEY_ID ? '✅ Set' : '❌ Missing');
    console.log('AWS_SECRET_ACCESS_KEY:', process.env.AWS_SECRET_ACCESS_KEY ? '✅ Set' : '❌ Missing');
    console.log('AWS_REGION:', process.env.AWS_REGION || '❌ Missing');
    console.log('AWS_S3_BUCKET_NAME:', process.env.AWS_S3_BUCKET_NAME || '❌ Missing');

    const missing = requiredEnvVars.filter(varName => !process.env[varName]);
    
    if (missing.length > 0) {
      console.error('❌ Missing required AWS S3 environment variables:', missing.join(', '));
      return false;
    }

    console.log('✅ All S3 environment variables are configured');
    return true;
  }
}

// Multer configuration for memory storage (since we're uploading to S3)
import multer from 'multer';

const memoryStorage = multer.memoryStorage();

const avatarFileFilter = (req: any, file: Express.Multer.File, cb: any) => {
  const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Only image files (JPEG, JPG, PNG, WebP) are allowed for avatars'), false);
  }
};

export const s3AvatarUpload = multer({
  storage: memoryStorage,
  fileFilter: avatarFileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB limit
  }
}); 