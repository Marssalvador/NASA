"""Serve build-time Brotli/gzip variants without recompressing a model per request."""
import re
from starlette.exceptions import HTTPException
from starlette.staticfiles import StaticFiles


class PrecompressedStaticFiles(StaticFiles):
    async def get_response(self, path, scope):
        path = 'index.html' if path in ('', '/') else path
        original = await super().get_response(path, scope)
        if original.status_code != 200:
            return original
        accept = dict(scope['headers']).get(b'accept-encoding', b'').decode('ascii', 'ignore')
        accepted = {}
        for token in accept.split(','):
            name, *parameters = token.strip().split(';')
            quality = 1.0
            for parameter in parameters:
                if parameter.strip().startswith('q='):
                    try:
                        quality = float(parameter.strip()[2:])
                    except ValueError:
                        quality = 0
            accepted[name] = quality
        selected = original
        for encoding, extension in [('br', '.br'), ('gzip', '.gz')]:
            if accepted.get(encoding, 0) <= 0:
                continue
            try:
                compressed = await super().get_response(path + extension, scope)
            except HTTPException as error:
                if error.status_code != 404:
                    raise
                continue
            if compressed.status_code in (200, 304):
                compressed.headers['content-encoding'] = encoding
                compressed.headers['content-type'] = original.headers.get('content-type', 'application/octet-stream')
                selected = compressed
                break
        selected.headers['vary'] = 'Accept-Encoding'
        selected.headers['cache-control'] = 'public, max-age=31536000, immutable' if re.search(r'/[^/]+-[\w-]{8,}\.(js|css|woff2)$', '/'+path) else 'no-cache'
        return selected
