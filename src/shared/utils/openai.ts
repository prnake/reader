import { get_encoding, Tiktoken } from 'tiktoken';

let encoder: Tiktoken | null = null;

function getEncoder(): Tiktoken | null {
    if (!encoder) {
        try {
            encoder = get_encoding('cl100k_base');
        } catch (e) {
            // Fallback if tiktoken fails
            encoder = null;
        }
    }
    return encoder;
}

export function countGPTToken(text: string): number {
    if (!text) return 0;

    try {
        const enc = getEncoder();
        if (enc) {
            return enc.encode(text).length;
        }
    } catch (e) {
        // Fallback to rough estimation
    }

    // Rough estimation: ~4 characters per token for English
    return Math.ceil(text.length / 4);
}

export function estimateTokens(text: string): number {
    return countGPTToken(text);
}
