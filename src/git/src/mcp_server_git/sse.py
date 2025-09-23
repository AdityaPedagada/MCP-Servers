import asyncio
import logging
from pathlib import Path
from typing import Optional
from mcp.server import Server
from mcp.server.sse import sse_server
from .server import setup_git_handlers
import sys

async def serve_sse(repository: Optional[Path] = None, port: int = 3001) -> None:
    """Serve the Git MCP server over SSE."""
    logger = logging.getLogger(__name__)
    
    if repository is not None:
        try:
            import git
            git.Repo(repository)
            logger.info(f"Using repository at {repository}")
        except git.InvalidGitRepositoryError:
            logger.error(f"{repository} is not a valid Git repository")
            return

    server = Server("mcp-git")
    setup_git_handlers(server, repository)
    
    options = server.create_initialization_options()
    
    async with sse_server(port=port) as (read_stream, write_stream):
        logger.info(f"Git MCP Server running on SSE port {port}")
        await server.run(read_stream, write_stream, options, raise_exceptions=True)

def main():
    """Main entry point for SSE server."""
    import argparse
    
    parser = argparse.ArgumentParser(description="Git MCP Server with SSE transport")
    parser.add_argument("--repository", type=Path, help="Path to Git repository")
    parser.add_argument("--port", type=int, default=3001, help="Port to run SSE server on")
    
    args = parser.parse_args()
    
    logging.basicConfig(level=logging.INFO)
    
    try:
        asyncio.run(serve_sse(args.repository, args.port))
    except KeyboardInterrupt:
        pass

if __name__ == "__main__":
    main()