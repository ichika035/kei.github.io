"""access.json の中身 (標準入力) をパスワードで暗号化し、access.enc.json の中身を標準出力に書く。

access.html はパスワードを打たれたときだけ、ブラウザの中でこれを復号して表示する。
公開するのは暗号化したものだけで、集計そのもの (access.json) は公開しない。
  ACCESS_PASSWORD  表示用のパスワード

鍵は PBKDF2-SHA256 で作り、AES-256-GCM で暗号化する (access.js の WebCrypto と同じ方式)。
"""
import base64
import json
import os
import sys

from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.primitives.ciphers.aead import AESGCM
from cryptography.hazmat.primitives.kdf.pbkdf2 import PBKDF2HMAC

ITERATIONS = 310000

password = os.environ["ACCESS_PASSWORD"].encode()
salt, iv = os.urandom(16), os.urandom(12)
key = PBKDF2HMAC(algorithm=hashes.SHA256(), length=32, salt=salt, iterations=ITERATIONS).derive(password)
data = AESGCM(key).encrypt(iv, sys.stdin.buffer.read(), None)

b64 = lambda b: base64.b64encode(b).decode()
print(json.dumps({"iter": ITERATIONS, "salt": b64(salt), "iv": b64(iv), "data": b64(data)}))
