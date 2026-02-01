# arXiv MCP Server

Claude Desktop から arXiv の論文を検索・取得できる MCP リモートサーバーです。
Cloudflare Workers 上で動作し、認証不要で誰でも利用できます。

An MCP remote server that lets you search and retrieve arXiv papers directly from Claude Desktop.
Runs on Cloudflare Workers with no authentication required.

---

## Tools / ツール一覧

| Tool | Description |
|------|-------------|
| `search_papers` | キーワード・著者・カテゴリで論文を検索 / Search papers by keyword, author, or category |
| `get_paper` | arXiv ID を指定して論文の詳細を取得 / Get paper details by arXiv ID |
| `get_recent_papers` | 指定カテゴリの最新論文を取得 / Get latest papers in a category |

---

## Setup / セットアップ

### Claude Desktop (Connectors)

最も簡単な接続方法です。 / The simplest way to connect.

1. Claude Desktop を開く / Open Claude Desktop
2. **Settings → Connectors** を開く / Go to **Settings → Connectors**
3. 以下の URL を追加 / Add the following URL:

```
https://arxiv-mcp-server.noisy-brook-6917.workers.dev/mcp
```

4. Claude を再起動 / Restart Claude

### Claude Desktop (claude_desktop_config.json)

設定ファイルから接続する場合は `mcp-remote` プロキシを使用します。
To connect via config file, use the `mcp-remote` proxy.

**Settings → Developer → Edit Config** を開き、以下を追加:
Open **Settings → Developer → Edit Config** and add:

```json
{
  "mcpServers": {
    "arxiv": {
      "command": "npx",
      "args": [
        "mcp-remote",
        "https://arxiv-mcp-server.noisy-brook-6917.workers.dev/mcp"
      ]
    }
  }
}
```

Claude を再起動すると、ツールが利用可能になります。
Restart Claude and the tools will become available.

---

## Usage Examples / 使用例

Claude に以下のように質問するだけで論文を検索できます。
Simply ask Claude to search for papers:

- 「Transformer に関する最新の論文を5件教えて」
- "Find the latest 5 papers about Transformers"
- 「arXiv ID 1706.03762 の論文の詳細を教えて」
- "Show me details for arXiv paper 1706.03762"
- 「cs.AI カテゴリの最新論文を見せて」
- "What are the newest papers in cs.AI?"

---

## Self-hosting / セルフホスト

自分の Cloudflare アカウントにデプロイすることもできます。
You can also deploy to your own Cloudflare account.

```bash
git clone https://github.com/hosokai-efil/arxiv-mcp-server.git
cd arxiv-mcp-server
npm install
npx wrangler login
npx wrangler deploy
```

デプロイ後、発行された URL の末尾に `/mcp` を付けて Claude Desktop に登録してください。
After deployment, register the issued URL with `/mcp` appended in Claude Desktop.

---

## Tech Stack / 技術スタック

| Component | Technology |
|-----------|-----------|
| Runtime | Cloudflare Workers |
| Language | TypeScript |
| Protocol | Streamable HTTP (`/mcp`) |
| Data Source | [arXiv API](https://info.arxiv.org/help/api/index.html) |

---

## License

MIT
