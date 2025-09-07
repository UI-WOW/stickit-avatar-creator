export type PersonalityTrait = string

export interface BrandIdentityInput {
  stickerGroupName?: string
  avatarType?: string
  avatarDescription?: string
  personalityTraits?: PersonalityTrait[]
}

export interface AvatarColorPalette {
  primary?: string
  secondary?: string
  accent?: string
  neutral?: string
}

export interface AvatarCreationInput {
  description?: string
  selectedStyle?: string
  colorPalette?: AvatarColorPalette
  referenceImageUrls?: string[]
}

export interface StickerDefinitionInput {
  id?: string
  name: string
  scenario: string
  description?: string
  notes?: string
  imageUrl?: string
  url?: string  // For generated stickers
  filename?: string  // For generated stickers
  size?: number  // For generated stickers
  generationTime?: number  // For generated stickers
  generatedAt?: string  // For generated stickers
}

export interface StickerGenerationInput {
  stickers?: StickerDefinitionInput[]
}

// Unified config input per group update
export interface GroupConfigInput {
  brandIdentity?: BrandIdentityInput
  avatarCreation?: AvatarCreationInput
  stickerGeneration?: StickerGenerationInput
}


