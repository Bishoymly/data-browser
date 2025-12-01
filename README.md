# Data Browser

A modern Next.js web application for browsing database schemas and data with AI-powered schema analysis, featuring an Apple-like design, advanced grid functionality, and intelligent relationship detection.

## Features

- **Database Connection**: Support for SQL Server (extensible to PostgreSQL, MySQL)
- **AI-Powered Schema Analysis**: Uses OpenAI to generate friendly names, identify important columns, and design profile layouts
- **Modern Data Grid**: TanStack Table with sorting, filtering, pagination, and column customization
- **Relationship Navigation**: View related tables and navigate between connected records
- **Profile Views**: Card-based layout for viewing record details and related data
- **Configuration Management**: Export/import configurations, save to server or database
- **Schema Caching**: Efficient caching of schema metadata for fast access

## Tech Stack

- **Framework**: Next.js 14+ (App Router)
- **UI**: shadcn/ui components with Tailwind CSS
- **Data Grid**: TanStack Table (React Table)
- **Database**: SQL Server (extensible architecture)
- **AI**: OpenAI API for schema analysis
- **State Management**: Zustand
- **Database Drivers**: `mssql` (node-mssql)

## Getting Started

### Prerequisites

- Node.js 18+ 
- npm or yarn
- SQL Server database (for testing)
- OpenAI API key (optional, can be provided during onboarding)

### Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd data-browser
```

2. Install dependencies:
```bash
npm install
```

3. Set up environment variables (optional):
```bash
# Create .env.local file
OPENAI_API_KEY=your_openai_api_key_here
```

4. Run the development server:
```bash
npm run dev
```

5. Open [http://localhost:3000](http://localhost:3000) in your browser.

## Usage

### Onboarding Wizard

1. **API Key Step** (if not in environment): Enter your OpenAI API key
2. **Connection Step**: Enter database connection details and test the connection
3. **Schema Selection**: Choose which tables to include (all, by schema, or specific tables)
4. **AI Analysis**: Wait while the AI analyzes your schema
5. **Review**: Review the configuration and complete setup

### Browsing Data

- Use the sidebar to navigate between tables
- Click on a table to view its data in the grid
- Use column selector to show/hide columns
- Sort and filter data as needed
- Click on a row to view its profile with related data

### Configuration Management

- Click the "Config" button in the dashboard
- Export configuration as JSON
- Import configuration from file
- Save configuration to server file
- Save configuration to database

## Project Structure

```
data-browser/
├── app/                    # Next.js App Router
│   ├── (dashboard)/       # Dashboard routes
│   └── api/               # API routes
├── components/            # React components
│   ├── ui/               # shadcn/ui components
│   ├── wizard/           # Onboarding wizard
│   ├── sidebar/          # Sidebar navigation
│   ├── grid/             # Data grid components
│   └── profile/          # Profile view components
├── lib/                   # Core libraries
│   ├── db/               # Database abstraction
│   ├── schema/           # Schema analysis
│   ├── ai/               # AI integration
│   └── config/           # Configuration management
├── stores/               # Zustand stores
└── types/                # TypeScript types
```

## Configuration

Configurations are stored in browser localStorage by default. You can:

- Export to JSON file
- Import from JSON file
- Save to server file system
- Save to database (in a metadata table)

## Development

### Adding New Database Support

1. Create a new adapter class extending `DatabaseAdapter` in `lib/db/`
2. Implement all required methods
3. Add the type to `DatabaseType` in `types/database.ts`
4. Update the factory in `lib/db/factory.ts`

### Customizing AI Analysis

Modify the prompt in `lib/ai/client.ts` to change how the AI analyzes schemas.

## License

MIT
