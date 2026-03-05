const fs = require('fs/promises');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const SUPABASE_STORAGE_BUCKET = process.env.SUPABASE_STORAGE_BUCKET || 'documents';

function isSupabaseStorageEnabled() {
    return Boolean(SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY);
}

function getSupabaseClient() {
    return createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
        auth: {
            persistSession: false,
            autoRefreshToken: false
        }
    });
}

async function uploadToSupabaseStorage(localPath, objectPath, contentType) {
    const supabase = getSupabaseClient();
    const buffer = await fs.readFile(localPath);

    const { error } = await supabase.storage
        .from(SUPABASE_STORAGE_BUCKET)
        .upload(objectPath, buffer, {
            contentType,
            upsert: false
        });

    if (error) {
        throw error;
    }

    const { data } = supabase.storage.from(SUPABASE_STORAGE_BUCKET).getPublicUrl(objectPath);
    return data?.publicUrl || null;
}

async function storeDocument(file, userId) {
    const localRelativePath = file.filename;
    const localPath = path.join(__dirname, '..', '..', 'uploads', localRelativePath);

    if (!isSupabaseStorageEnabled()) {
        return {
            storage_mode: 'local',
            file_path: localRelativePath,
            public_url: null
        };
    }

    const objectPath = `${userId}/${Date.now()}_${file.filename}`;
    const publicUrl = await uploadToSupabaseStorage(localPath, objectPath, file.mimetype);

    await fs.unlink(localPath).catch(() => {});

    return {
        storage_mode: 'supabase',
        file_path: objectPath,
        public_url: publicUrl
    };
}

module.exports = {
    isSupabaseStorageEnabled,
    storeDocument
};
