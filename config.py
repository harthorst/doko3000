import os
from pathlib import Path
basedir = Path(__file__).parent

class Config:
    # to be given by environment variable
    SECRET_KEY = os.environ.get('SECRET_KEY') or 'dummykey'
    SQLALCHEMY_DATABASE_URL = os.environ.get('SQLALCHEMY_DATABASE_URL') or basedir / 'doko3000.db'
