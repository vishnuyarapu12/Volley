"""
Supabase Storage client for VolleyTrack.
Handles all image upload, delete, and listing operations against
the Supabase Storage REST API using the service_role key.

All uploads go through the Flask backend — the service_role key
is NEVER exposed to the frontend.
"""

import os
import uuid
import logging
import requests as http_requests
import config

logger = logging.getLogger(__name__)

# Allowed image MIME types and their extensions
ALLOWED_MIME_TYPES = {
    'image/jpeg': '.jpg',
    'image/png': '.png',
    'image/webp': '.webp',
    'image/gif': '.gif',
}

MAX_IMAGE_SIZE = 10 * 1024 * 1024  # 10 MB


def _headers():
    """Build auth headers for Supabase Storage REST API."""
    return {
        'Authorization': f'Bearer {config.SUPABASE_SERVICE_KEY}',
        'apikey': config.SUPABASE_SERVICE_KEY,
    }


def _storage_url(path=''):
    """Build the full Supabase Storage API URL."""
    base = config.SUPABASE_URL.rstrip('/')
    return f'{base}/storage/v1{path}'


def _public_url(bucket, file_path):
    """Build the public URL for a stored object."""
    base = config.SUPABASE_URL.rstrip('/')
    return f'{base}/storage/v1/object/public/{bucket}/{file_path}'


def validate_image(file_stream, filename, content_type=None):
    """
    Validate an uploaded image file.
    Returns (is_valid, error_message, detected_ext).
    """
    if not filename:
        return False, 'No filename provided', None

    # Check MIME type
    ext = None
    if content_type and content_type in ALLOWED_MIME_TYPES:
        ext = ALLOWED_MIME_TYPES[content_type]
    else:
        # Fallback: check file extension
        file_ext = os.path.splitext(filename)[1].lower()
        if file_ext in ('.jpg', '.jpeg'):
            ext = '.jpg'
        elif file_ext in ('.png',):
            ext = '.png'
        elif file_ext in ('.webp',):
            ext = '.webp'
        elif file_ext in ('.gif',):
            ext = '.gif'

    if not ext:
        return False, 'Only JPG, PNG, WebP, and GIF images are allowed', None

    # Check file size by reading content
    file_stream.seek(0, 2)  # Seek to end
    size = file_stream.tell()
    file_stream.seek(0)     # Reset to beginning

    if size > MAX_IMAGE_SIZE:
        return False, f'Image must be under {MAX_IMAGE_SIZE // (1024*1024)} MB', None

    if size == 0:
        return False, 'File is empty', None

    return True, None, ext


def upload_image(bucket, folder, file_stream, original_filename, content_type=None):
    """
    Upload an image to Supabase Storage.

    Args:
        bucket: Storage bucket name (e.g. 'volleytrack-images')
        folder: Folder path within bucket (e.g. 'moments/' or 'profiles/')
        file_stream: File-like object with .read()
        original_filename: Original filename for extension detection
        content_type: MIME type of the file

    Returns:
        dict with 'success', 'url', 'storage_path', 'error'
    """
    try:
        # Validate
        is_valid, error, ext = validate_image(file_stream, original_filename, content_type)
        if not is_valid:
            return {'success': False, 'error': error}

        # Generate unique filename: uuid + extension
        unique_name = f'{uuid.uuid4().hex}{ext}'
        storage_path = f'{folder.strip("/")}/{unique_name}'

        # Read file bytes
        file_bytes = file_stream.read()

        # Determine content type for the upload
        mime_map = {'.jpg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp', '.gif': 'image/gif'}
        upload_content_type = mime_map.get(ext, 'application/octet-stream')

        # Upload via Supabase Storage REST API
        url = _storage_url(f'/object/{bucket}/{storage_path}')
        headers = _headers()
        headers['Content-Type'] = upload_content_type

        response = http_requests.post(url, headers=headers, data=file_bytes, timeout=30)

        if response.status_code in (200, 201):
            public_url = _public_url(bucket, storage_path)
            logger.info(f'Uploaded image to {storage_path}')
            return {
                'success': True,
                'url': public_url,
                'storage_path': storage_path,
            }
        else:
            error_detail = response.text[:200]
            logger.error(f'Supabase upload failed ({response.status_code}): {error_detail}')
            return {
                'success': False,
                'error': f'Storage upload failed: {response.status_code}',
            }

    except http_requests.exceptions.Timeout:
        logger.error('Supabase upload timed out')
        return {'success': False, 'error': 'Upload timed out. Please try again.'}
    except Exception as e:
        logger.exception('Unexpected error during image upload')
        return {'success': False, 'error': 'Upload failed unexpectedly'}


def delete_image(bucket, storage_path):
    """
    Delete an image from Supabase Storage.

    Args:
        bucket: Storage bucket name
        storage_path: Path within the bucket (e.g. 'moments/abc123.jpg')

    Returns:
        dict with 'success' and optionally 'error'
    """
    try:
        if not storage_path:
            return {'success': False, 'error': 'No storage path provided'}

        url = _storage_url(f'/object/{bucket}')
        headers = _headers()
        headers['Content-Type'] = 'application/json'

        # Supabase delete expects a JSON body with prefixes array
        response = http_requests.delete(
            url,
            headers=headers,
            json={'prefixes': [storage_path]},
            timeout=15
        )

        if response.status_code in (200, 201, 204):
            logger.info(f'Deleted image: {storage_path}')
            return {'success': True}
        else:
            logger.error(f'Supabase delete failed ({response.status_code}): {response.text[:200]}')
            return {'success': False, 'error': f'Delete failed: {response.status_code}'}

    except Exception:
        logger.exception('Error deleting image from Supabase')
        return {'success': False, 'error': 'Delete failed'}


def list_images(bucket, folder):
    """
    List all images in a folder within a Supabase Storage bucket.

    Args:
        bucket: Storage bucket name
        folder: Folder path (e.g. 'moments')

    Returns:
        list of dicts with 'name', 'url', 'storage_path'
    """
    try:
        url = _storage_url(f'/object/list/{bucket}')
        headers = _headers()
        headers['Content-Type'] = 'application/json'

        response = http_requests.post(
            url,
            headers=headers,
            json={
                'prefix': folder.strip('/') + '/',
                'limit': 1000,
                'offset': 0,
                'sortBy': {'column': 'created_at', 'order': 'desc'},
            },
            timeout=15
        )

        if response.status_code == 200:
            items = response.json()
            result = []
            for item in items:
                name = item.get('name', '')
                if not name or name.startswith('.'):
                    continue
                storage_path = f'{folder.strip("/")}/{name}'
                result.append({
                    'name': name,
                    'url': _public_url(bucket, storage_path),
                    'storage_path': storage_path,
                })
            return result
        else:
            logger.error(f'Failed to list images ({response.status_code}): {response.text[:200]}')
            return []

    except Exception:
        logger.exception('Error listing images from Supabase')
        return []
