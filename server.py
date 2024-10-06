import http.server
from http.server import HTTPServer, SimpleHTTPRequestHandler
import ssl

PORT = 8443  # HTTPS typically uses port 443, but 8443 is used here to avoid requiring admin privileges

# Define the handler and specify MIME types
class CustomHandler(SimpleHTTPRequestHandler):
    extensions_map = {
        '.manifest': 'text/cache-manifest',
        '.html': 'text/html',
        '.png': 'image/png',
        '.jpg': 'image/jpg',
        '.svg': 'image/svg+xml',
        '.css': 'text/css',
        '.js': 'application/javascript',
        '': 'application/octet-stream',  # Default
    }

# Create the server
httpd = HTTPServer(('192.168.31.66', PORT), CustomHandler)

# Path to your SSL certificate and key
# If you used mkcert:
# cert_file = 'localhost.pem'
# key_file = 'localhost-key.pem'

# If you used OpenSSL:
cert_file = 'localhost.crt'
key_file = 'localhost.key'

# Wrap the server's socket with SSL
httpd.socket = ssl.wrap_socket(httpd.socket,
                               keyfile=key_file,
                               certfile=cert_file,
                               server_side=True)

print(f"Serving HTTPS on https://localhost:{PORT}")
httpd.serve_forever()
