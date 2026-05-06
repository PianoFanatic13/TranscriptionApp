from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    # Required
    supabase_url: str
    supabase_service_key: str
    groq_api_key: str

    # Embedding
    embedding_model: str = "BAAI/bge-small-en-v1.5"

    # Chunking
    chunk_size: int = 384
    chunk_overlap: int = 64

    # Retrieval
    retrieval_candidate_k: int = 50  # candidates from each retriever before RRF
    top_k: int = 10                  # final chunks sent to Groq
    rrf_k: int = 60                  # RRF constant

    class Config:
        env_file = ".env"


settings = Settings()
