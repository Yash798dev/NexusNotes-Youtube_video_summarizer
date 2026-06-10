# NexusNotes 📚

> A modern note-taking application built with intelligent audio processing and visual knowledge mapping capabilities.


---

## 🌟 Features

### 📝 Smart Note-Taking
- Create and organize notes with rich formatting support
- Markdown rendering with GitHub Flavored Markdown (GFM) extensions
- Real-time note editing and updates

### 🎙️ Audio Processing
- Convert audio/video content to actionable notes
- Powered by OpenAI Whisper for accurate speech-to-text transcription
- Support for multiple audio formats
- Backend processing with FastAPI

### 🗺️ Knowledge Visualization
- **Markmap** - Create interactive mind maps from your notes
- **Mermaid** - Generate diagrams and flowcharts for complex concepts
- Visual representation of interconnected ideas

### 🎥 Video Integration
- Process YouTube and video content
- Extract and summarize key information
- Integrated video support throughout the application

### 💾 Persistent Storage
- Cloud-based data persistence with Render.com integration
- SQLite database for reliable note storage
- 1GB dedicated storage disk for media files

---

## 🏗️ Architecture

NexusNotes is built as a **full-stack monorepo** with clear separation of concerns:

### Frontend (`/frontend`)
- **Framework**: Next.js 16.2.6
- **Language**: TypeScript (58.7% of codebase)
- **Styling**: Tailwind CSS v4
- **Rendering**: React 19.2.4 + React DOM

**Key Dependencies:**
```
- react-markdown: Rich markdown support
- remark-gfm: GitHub Flavored Markdown extension
- markmap-lib & markmap-view: Interactive mind mapping
- mermaid: Diagram and flowchart generation
- @tailwindcss/postcss: Advanced Tailwind styling
```

### Backend (`/backend`)
- **Framework**: FastAPI (Python)
- **Language**: Python (35% of codebase)
- **Speech Recognition**: OpenAI Whisper
- **ML Framework**: PyTorch
- **Server**: Uvicorn ASGI server

**Key Capabilities:**
```
- Audio/Video processing with Whisper (base model)
- Google API integration for extended features
- RESTful API endpoints
- Persistent data management
```

---

## 🚀 Getting Started

### Prerequisites

- **Node.js** 18+ (for frontend)
- **Python** 3.8+ (for backend)
- **Git** for version control

### Installation

#### 1. Clone the Repository
```bash
git clone https://github.com/Yash798dev/NexusNotes.git
cd NexusNotes
```

#### 2. Frontend Setup

```bash
cd frontend
npm install
npm run dev
```

The frontend will be available at `http://localhost:3000`

#### 3. Backend Setup

```bash
cd backend
pip install -r requirements.txt
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

The backend API will be available at `http://localhost:8000`

### Configuration

#### Environment Variables

**Backend** (`.env` or via Render dashboard):
```env
GOOGLE_API_KEY=your_google_api_key_here
WHISPER_MODEL=base
DATA_DIR=/data
```

**Frontend** (`.env.local` or via Render dashboard):
```env
NEXT_PUBLIC_API_URL=http://localhost:8000
PORT=3000
```

---

## 📋 Project Structure

```
NexusNotes/
├── frontend/                    # Next.js React application
│   ├── src/
│   ├── public/
│   ├── package.json
│   └── tsconfig.json
│
├── backend/                     # FastAPI Python server
│   ├── main.py
│   ├── requirements.txt
│   └── render-build.sh
│
├── render.yaml                  # Render.com deployment config
├── .gitignore
└── README.md
```

---

## 🔧 Development

### Frontend Development Scripts

```bash
# Development server with hot reload
npm run dev

# Production build
npm run build

# Start production server
npm start

# Lint code
npm run lint
```

### Backend Development

```bash
# Run with auto-reload
uvicorn main:app --reload

# Production server
uvicorn main:app --host 0.0.0.0 --port 8000
```

---

## 🚢 Deployment

### Deploying to Render.com

The project includes a `render.yaml` configuration for seamless deployment:

#### Backend Service
- **Runtime**: Python
- **Plan**: Standard (2GB RAM for Whisper + PyTorch)
- **Build Command**: `chmod +x render-build.sh && ./render-build.sh`
- **Start Command**: `uvicorn main:app --host 0.0.0.0 --port $PORT`
- **Storage**: 1GB persistent disk for data

#### Frontend Service
- **Runtime**: Node.js
- **Plan**: Starter
- **Build Command**: `npm install && npm run build`
- **Start Command**: `npm run start`

### Deployment Steps

1. Push your code to GitHub
2. Connect your GitHub repository to Render.com
3. Create new services using the provided `render.yaml` configuration
4. Set required environment variables in the Render dashboard:
   - `GOOGLE_API_KEY` (backend)
   - `NEXT_PUBLIC_API_URL` (frontend - set to backend Render URL)
5. Deploy and monitor from the Render dashboard

---

## 🛠️ Technology Stack

| Layer | Technology | Version |
|-------|-----------|---------|
| **Frontend** | Next.js | 16.2.6 |
| | React | 19.2.4 |
| | TypeScript | 5.x |
| | Tailwind CSS | 4.x |
| **Visualization** | Markmap | 0.18.12 |
| | Mermaid | 11.15.0 |
| **Backend** | FastAPI | Latest |
| | Python | 3.8+ |
| | Uvicorn | Latest |
| | Whisper | base model |
| **Database** | SQLite | Latest |
| **Deployment** | Render.com | N/A |

---

## 📚 Key Libraries & Dependencies

### Frontend Dependencies
- **react-markdown**: Parse and render Markdown content
- **remark-gfm**: Support for GitHub Flavored Markdown tables and strikethrough
- **markmap-lib & markmap-view**: Create interactive mind maps
- **mermaid**: Render diagrams from text definitions
- **@tailwindcss/postcss**: Utility-first CSS framework

### Backend Dependencies
- **FastAPI**: Modern async web framework
- **Uvicorn**: ASGI server implementation
- **OpenAI Whisper**: Speech-to-text transcription
- **PyTorch**: ML framework (required by Whisper)
- **Google API Client**: Integration with Google services

---

## 🤝 Contributing

We welcome contributions! Here's how you can help:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

### Code Standards

- **Frontend**: Follow TypeScript best practices and ESLint configuration
- **Backend**: Follow PEP 8 and FastAPI conventions
- **Commits**: Use clear, descriptive commit messages

---

## 🐛 Troubleshooting

### Common Issues

**Backend won't start**
- Ensure Python 3.8+ is installed
- Check that all dependencies are installed: `pip install -r requirements.txt`
- Verify the port (8000) is not in use
- Check environment variables are properly set

**Frontend build fails**
- Clear node_modules: `rm -rf node_modules package-lock.json`
- Reinstall dependencies: `npm install`
- Check Node.js version (18+)

**Whisper model download issues**
- Ensure sufficient disk space (base model ~140MB)
- Check internet connection
- Verify `WHISPER_MODEL` environment variable is set correctly

**API connection errors**
- Verify `NEXT_PUBLIC_API_URL` is correctly set to backend URL
- Check that both services are running
- Ensure CORS is properly configured in FastAPI backend

---

## 📄 License

This project is open source and available under the MIT License - see the LICENSE file for details.

---

## 📞 Support & Feedback

- **Issues**: [GitHub Issues](https://github.com/Yash798dev/NexusNotes/issues)
- **Discussions**: [GitHub Discussions](https://github.com/Yash798dev/NexusNotes/discussions)
- **Author**: [@Yash798dev](https://github.com/Yash798dev)

---

## 🎯 Roadmap

- [ ] Real-time collaboration features
- [ ] Enhanced AI-powered note summarization
- [ ] Mobile app (React Native)
- [ ] Self-hosted deployment guide
- [ ] Plugin system for custom integrations
- [ ] Advanced search and filtering
- [ ] Dark mode support
- [ ] Multi-language transcription support

---

## ⭐ Show Your Support

If you found this project helpful, please consider giving it a star! ⭐

---

**Built with ❤️ by the NexusNotes Team**
