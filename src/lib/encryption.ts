// Simple encryption for sensitive data in browser
// Uses Web Crypto API for better security than plain storage

const ENCRYPTION_KEY_NAME = 'logistics-encryption-key';

async function getEncryptionKey(): Promise<CryptoKey> {
    // In a real app, this key should be derived from user password
    // For now, we'll generate and store a key
    const stored = localStorage.getItem(ENCRYPTION_KEY_NAME);

    if (stored) {
        const keyData = JSON.parse(stored);
        return crypto.subtle.importKey(
            'jwk',
            keyData,
            { name: 'AES-GCM', length: 256 },
            true,
            ['encrypt', 'decrypt']
        );
    }

    // Generate new key
    const key = await crypto.subtle.generateKey(
        { name: 'AES-GCM', length: 256 },
        true,
        ['encrypt', 'decrypt']
    );

    const exported = await crypto.subtle.exportKey('jwk', key);
    localStorage.setItem(ENCRYPTION_KEY_NAME, JSON.stringify(exported));

    return key;
}

export async function encrypt(data: string): Promise<string> {
    const key = await getEncryptionKey();
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const encoded = new TextEncoder().encode(data);

    const encrypted = await crypto.subtle.encrypt(
        { name: 'AES-GCM', iv },
        key,
        encoded
    );

    // Combine IV and encrypted data
    const combined = new Uint8Array(iv.length + encrypted.byteLength);
    combined.set(iv, 0);
    combined.set(new Uint8Array(encrypted), iv.length);

    // Convert to base64
    return btoa(String.fromCharCode(...combined));
}

export async function decrypt(encryptedData: string): Promise<string> {
    try {
        const key = await getEncryptionKey();

        // Decode from base64
        const combined = Uint8Array.from(atob(encryptedData), c => c.charCodeAt(0));

        // Extract IV and encrypted data
        const iv = combined.slice(0, 12);
        const data = combined.slice(12);

        const decrypted = await crypto.subtle.decrypt(
            { name: 'AES-GCM', iv },
            key,
            data
        );

        return new TextDecoder().decode(decrypted);
    } catch (error) {
        console.error('Decryption failed:', error);
        throw new Error('Failed to decrypt data');
    }
}

export async function encryptObject<T>(obj: T): Promise<string> {
    return encrypt(JSON.stringify(obj));
}

export async function decryptObject<T>(encryptedData: string): Promise<T> {
    const decrypted = await decrypt(encryptedData);
    return JSON.parse(decrypted);
}

// Hash password for authentication
export async function hashPassword(password: string): Promise<string> {
    const encoder = new TextEncoder();
    const data = encoder.encode(password);
    const hash = await crypto.subtle.digest('SHA-256', data);
    return Array.from(new Uint8Array(hash))
        .map(b => b.toString(16).padStart(2, '0'))
        .join('');
}
