import uvicorn
from config import HOST, PORT

if __name__ == "__main__":
    uvicorn.run("api:app", host=HOST, port=PORT, reload=True)