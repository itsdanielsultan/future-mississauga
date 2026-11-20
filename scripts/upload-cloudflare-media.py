"""Publish one release to the dedicated private R2 Standard bucket using scoped S3 credentials."""
import hashlib
import json
import os
import sys
from pathlib import Path

CAP = 8_000_000_000
BUCKET = 'future-mississauga-media'
LOCK = '.future-mississauga-upload-lock'

def plan(objects, stored):
    """Count existing historical objects and deduplicate retries before writing anything."""
    used = sum(stored.values())
    pending = {}
    for key, row in objects.items():
        if row['key'] != key or len(key) != 64 or any(c not in '0123456789abcdef' for c in key):
            raise ValueError('Invalid release object identifier')
        size = row['bytes']
        if not isinstance(size, int) or size <= 0:
            raise ValueError('Invalid release size')
        if key in stored:
            if stored[key] != size:
                raise ValueError('Unexpected object already exists at release key')
        else:
            pending[key] = row
    total = used + sum(row['bytes'] for row in pending.values())
    if total > CAP:
        raise ValueError(f'Upload blocked: projected {total:,} bytes exceeds {CAP:,}')
    return pending, total

def main():
    import boto3
    from botocore.config import Config
    from botocore.exceptions import ClientError
    release = Path(__file__).resolve().parents[1] / '.cloudflare-release'
    objects = json.loads((release/'objects.json').read_text())
    account = os.environ['CLOUDFLARE_ACCOUNT_ID']
    if len(account) != 32 or any(c not in '0123456789abcdef' for c in account):
        raise ValueError('Invalid account identifier')
    client = boto3.client('s3', endpoint_url=f'https://{account}.r2.cloudflarestorage.com', region_name='auto',
                          aws_access_key_id=os.environ['R2_ACCESS_KEY_ID'], aws_secret_access_key=os.environ['R2_SECRET_ACCESS_KEY'],
                          config=Config(retries={'total_max_attempts':3}))
    # S3 conditional create serializes all cooperating uploaders, including CI.
    # A process interruption leaves the lock closed for operator recovery.
    try:
        marker = client.get_object(Bucket=BUCKET,Key=LOCK)
    except ClientError as error:
        if error.response['ResponseMetadata']['HTTPStatusCode'] != 404:
            raise
        condition = {'IfNoneMatch':'*'}
    else:
        if marker['Body'].read() != b'idle':
            raise RuntimeError('Another upload holds the release lock')
        condition = {'IfMatch':marker['ETag']}
    receipt = client.put_object(Bucket=BUCKET,Key=LOCK,Body=os.urandom(24),**condition)
    try:
        paginator = client.get_paginator('list_objects_v2')
        stored = {o['Key']:o['Size'] for page in paginator.paginate(Bucket=BUCKET) for o in page.get('Contents',[])}
        pending,total = plan(objects,stored)
        print(f'{len(pending)} new objects; projected total {total:,} of {CAP:,} bytes',flush=True)
        for key,row in pending.items():
            with (release/'media'/key).open('rb') as source:
                digest = hashlib.sha256()
                for block in iter(lambda: source.read(1024*1024),b''):
                    digest.update(block)
                if digest.hexdigest() != key or source.tell() != row['bytes']:
                    raise ValueError('Local content does not match release inventory')
                source.seek(0)
                client.put_object(Bucket=BUCKET,Key=key,Body=source,ContentLength=row['bytes'],ContentType=row['type'],
                                  StorageClass='STANDARD',IfNoneMatch='*')
    finally:
        client.put_object(Bucket=BUCKET,Key=LOCK,Body=b'idle',IfMatch=receipt['ETag'])

if __name__=='__main__':
    main()
