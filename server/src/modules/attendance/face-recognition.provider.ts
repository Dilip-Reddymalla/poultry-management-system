export interface FaceEmbedding {
  /**
   * The mathematical representation of a face, typically a high-dimensional vector.
   * e.g., Float32Array or array of numbers.
   */
  vector: number[];
  
  /**
   * Version of the model used to generate this embedding.
   */
  modelVersion: string;
}

export interface FaceProfile {
  id: string;
  
  /**
   * The person this profile belongs to.
   */
  personType: "EMPLOYEE" | "WORKER";
  personId: string;
  
  /**
   * The biometric data.
   */
  embedding: FaceEmbedding;
  
  createdAt: Date;
  updatedAt: Date;
}

export interface FaceMatchResult {
  /**
   * Whether a confident match was found.
   */
  isMatch: boolean;
  
  /**
   * The matched profile, if any.
   */
  profile?: FaceProfile;
  
  /**
   * Confidence score between 0 and 1.
   */
  confidenceScore: number;
  
  /**
   * The threshold used to determine the match.
   */
  thresholdUsed: number;
}

/**
 * Abstract interface for Face Recognition capabilities.
 * The implementation (e.g., AWS Rekognition, Azure Face, local model) will
 * implement this interface, allowing the Attendance module to remain agnostic.
 */
export interface FaceRecognitionProvider {
  /**
   * Extract an embedding from an image buffer (e.g., JPEG or PNG).
   */
  extractEmbedding(imageBuffer: Buffer): Promise<FaceEmbedding>;
  
  /**
   * Find the best matching profile for a given embedding among a list of candidate profiles.
   */
  findMatch(
    embedding: FaceEmbedding,
    candidates: FaceProfile[],
  ): Promise<FaceMatchResult>;
}
