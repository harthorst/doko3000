import os
from pathlib import Path

basedir = Path(__file__).parent


class Config:
    TITLE = 'doko3000'
    # to be given by environment variable
    SECRET_KEY = os.environ.get('SECRET_KEY') or 'dummykey'
    # database
    # CouchDB, according to https://hub.docker.com/_/couchdb
    COUCHDB_URL = os.environ.get('COUCHDB_URL') or 'http://couchdb:5984'
    COUCHDB_DATABASE = os.environ.get('COUCHDB_DATABASE') or 'doko3000'
    COUCHDB_USER = os.environ.get('COUCHDB_USER') or 'admin'
    COUCHDB_PASSWORD = os.environ.get('COUCHDB_PASSWORD') or 'doko3000'


class DummyApp:
    def __init__(self):
        self.config = Config.__dict__
