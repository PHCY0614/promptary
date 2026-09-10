export const ErrorCode = {
  transactionAborted: "transactionAborted",
  dbBlocked: "dbBlocked",
  revisionConflict: "revisionConflict",
  imageMissingRetry: "imageMissingRetry",
  legacyImageUnrecognized: "legacyImageUnrecognized",
  archiveUnrecognized: "archiveUnrecognized",
  legacyRemoteImage: "legacyRemoteImage",
  legacyImageMissing: "legacyImageMissing",
  imageMissing: "imageMissing",
  quotaExceeded: "quotaExceeded",
  storagePermission: "storagePermission",
  storageFailed: "storageFailed",
  backupImagesIncomplete: "backupImagesIncomplete",
  backupDuplicateImageId: "backupDuplicateImageId",
  backupInvalid: "backupInvalid",
  backupDuplicateMeta: "backupDuplicateMeta",
  backupZipTooLarge: "backupZipTooLarge",
  backupZipTooMany: "backupZipTooMany",
  backupZipUnsupported: "backupZipUnsupported",
  backupZipUnsafePath: "backupZipUnsafePath",
  backupZipEntryTooLarge: "backupZipEntryTooLarge",
  backupZipUncompressed: "backupZipUncompressed",
  backupImageMissing: "backupImageMissing",
  importZipTooLarge: "importZipTooLarge",
  importReadFailed: "importReadFailed",
  importSaveFailed: "importSaveFailed",
  importFailed: "importFailed",
  imageReadFailed: "imageReadFailed",
  imageProcessFailed: "imageProcessFailed",
  imageParseFailed: "imageParseFailed",
  imageEncodeFailed: "imageEncodeFailed",
  imageSizeUnknown: "imageSizeUnknown",
  imageTooManyPixels: "imageTooManyPixels",
  imageCanvasFailed: "imageCanvasFailed",
  imageOptimizeFailed: "imageOptimizeFailed",
  imageTypeUnsupported: "imageTypeUnsupported",
  imageFileTooLarge: "imageFileTooLarge",
  imageOutputTypeUnsupported: "imageOutputTypeUnsupported",
  backupImageTypeUnsupported: "backupImageTypeUnsupported",
  backupImageSizeMismatch: "backupImageSizeMismatch",
  backupImageManifestMismatch: "backupImageManifestMismatch",
  platformSaveFailed: "platformSaveFailed",
  platformNameRequired: "platformNameRequired",
} as const;

export type ErrorCode = (typeof ErrorCode)[keyof typeof ErrorCode];

const ERROR_CODE_SET = new Set<string>(Object.values(ErrorCode));

export function isErrorCode(value: string): value is ErrorCode {
  return ERROR_CODE_SET.has(value);
}

export function fail(code: ErrorCode): never {
  throw new Error(code);
}
