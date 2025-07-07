import { useState } from 'react'
import Anthropic from '@anthropic-ai/sdk'
import './App.css'

// Initialize Claude
const anthropic = new Anthropic({
  apiKey: import.meta.env.VITE_CLAUDE_API_KEY,
  dangerouslyAllowBrowser: true
})

// Our smart categorization system
const CATEGORIES = {
  'PROJECTS': {
    emoji: '📋',
    color: '#ff6b6b',
    description: 'Active work with deadlines'
  },
  'CAREER': {
    emoji: '💼', 
    color: '#4ecdc4',
    description: 'Professional growth & work'
  },
  'HEALTH': {
    emoji: '🏃‍♂️',
    color: '#45b7d1',
    description: 'Physical & mental wellness'
  },
  'RELATIONSHIPS': {
    emoji: '❤️',
    color: '#f9ca24',
    description: 'Family, friends, romance'
  },
  'FINANCES': {
    emoji: '💰',
    color: '#6c5ce7',
    description: 'Money, investing, budgeting'
  },
  'LEARNING': {
    emoji: '📚',
    color: '#a29bfe',
    description: 'Education, skills, growth'
  },
  'RECREATION': {
    emoji: '🎉',
    color: '#fd79a8',
    description: 'Hobbies, fun, entertainment'
  },
  'ENVIRONMENT': {
    emoji: '🏠',
    color: '#00b894',
    description: 'Home, workspace, surroundings'
  },
  'RESOURCES': {
    emoji: '🗄️',
    color: '#636e72',
    description: 'Reference materials'
  },
  'ARCHIVE': {
    emoji: '📁',
    color: '#b2bec3',
    description: 'Completed or inactive'
  }
}

function App() {
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [documents, setDocuments] = useState([])
  const [isLoading, setIsLoading] = useState(false)
  const [isProcessing, setIsProcessing] = useState(false)
  const [selectedCategory, setSelectedCategory] = useState('ALL')

  // AI-powered categorization
  const categorizeDocument = async (filename, content) => {
    try {
      const response = await anthropic.messages.create({
        model: "claude-3-5-sonnet-20241022",
        max_tokens: 100,
        messages: [{
          role: "user",
          content: `Analyze this document and categorize it according to the P.A.R.A. method + Wheel of Life areas.

Document: "${filename}"
Content preview: "${content.substring(0, 500)}..."

Categories to choose from:
- PROJECTS: Active work with deadlines
- CAREER: Professional growth & work  
- HEALTH: Physical & mental wellness
- RELATIONSHIPS: Family, friends, romance
- FINANCES: Money, investing, budgeting
- LEARNING: Education, skills, growth
- RECREATION: Hobbies, fun, entertainment
- ENVIRONMENT: Home, workspace, surroundings
- RESOURCES: Reference materials
- ARCHIVE: Completed or inactive

Respond with just the category name (e.g., "CAREER" or "LEARNING").`
        }]
      })
      
      const suggestedCategory = response.content[0].text.trim().toUpperCase()
      return CATEGORIES[suggestedCategory] ? suggestedCategory : 'RESOURCES'
    } catch (error) {
      console.error('Categorization error:', error)
      return 'RESOURCES' // Default fallback
    }
  }

  // Process uploaded files with AI categorization
  const processFile = async (file) => {
    return new Promise(async (resolve) => {
      const reader = new FileReader()
      reader.onload = async (e) => {
        const content = e.target.result
        
        // Get AI category suggestion
        const category = await categorizeDocument(file.name, content)
        
        // Simple chunking - split by paragraphs
        const chunks = content
          .split('\n\n')
          .filter(chunk => chunk.trim().length > 50)
          .map((chunk, index) => ({
            id: `${file.name}-chunk-${index}`,
            content: chunk.trim(),
            filename: file.name,
            chunkIndex: index
          }))

        resolve({
          filename: file.name,
          size: file.size,
          chunks: chunks,
          category: category,
          uploadedAt: new Date().toISOString()
        })
      }
      reader.readAsText(file)
    })
  }

  // Handle file uploads with AI categorization
  const handleFileUpload = async (event) => {
    const files = Array.from(event.target.files)
    setIsProcessing(true)

    for (const file of files) {
      if (file.type === 'text/plain' || file.name.endsWith('.md')) {
        try {
          const processedDoc = await processFile(file)
          setDocuments(prev => [...prev, processedDoc])
        } catch (error) {
          console.error('Error processing file:', error)
        }
      }
    }
    
    setIsProcessing(false)
    event.target.value = ''
  }

  // Update document category
  const updateDocumentCategory = (filename, newCategory) => {
    setDocuments(prev => 
      prev.map(doc => 
        doc.filename === filename 
          ? { ...doc, category: newCategory }
          : doc
      )
    )
  }

  // Filter documents by category
  const filteredDocuments = selectedCategory === 'ALL' 
    ? documents 
    : documents.filter(doc => doc.category === selectedCategory)

  // Find relevant document chunks for a question
  const findRelevantChunks = (question) => {
    const questionWords = question.toLowerCase().split(' ')
    const searchDocs = selectedCategory === 'ALL' ? documents : filteredDocuments
    const allChunks = searchDocs.flatMap(doc => doc.chunks)
    
    return allChunks
      .map(chunk => {
        const chunkWords = chunk.content.toLowerCase()
        const relevanceScore = questionWords.reduce((score, word) => {
          return chunkWords.includes(word) ? score + 1 : score
        }, 0)
        return { ...chunk, relevanceScore }
      })
      .filter(chunk => chunk.relevanceScore > 0)
      .sort((a, b) => b.relevanceScore - a.relevanceScore)
      .slice(0, 3)
  }

  // Ask Claude with document context
  const askClaude = async (question) => {
    setIsLoading(true)
    
    try {
      const relevantChunks = findRelevantChunks(question)
      
      let prompt = `You are a helpful AI assistant. `
      
      if (relevantChunks.length > 0) {
        prompt += `The user has provided some documents, and here are the most relevant sections:

${relevantChunks.map((chunk, index) => 
  `Document "${chunk.filename}" (Section ${index + 1}):\n${chunk.content}`
).join('\n\n---\n\n')}

Based on this information and your general knowledge, please answer the user's question: "${question}"`
      } else {
        prompt += `The user has asked: "${question}". Please provide a helpful response.`
      }

      const response = await anthropic.messages.create({
        model: "claude-3-5-sonnet-20241022",
        max_tokens: 1000,
        messages: [{ role: "user", content: prompt }]
      })
      
      const aiResponse = response.content[0].text
      
      setMessages(prev => [...prev, 
        { 
          type: 'user', 
          content: question 
        },
        { 
          type: 'ai', 
          content: aiResponse,
          sourceDocs: relevantChunks.map(chunk => chunk.filename)
        }
      ])
    } catch (error) {
      console.error('Error:', error)
      setMessages(prev => [...prev, 
        { type: 'user', content: question },
        { type: 'ai', content: 'Sorry, I encountered an error. Please try again.' }
      ])
    }
    
    setIsLoading(false)
  }

  const handleAsk = () => {
    if (input.trim()) {
      askClaude(input)
      setInput('')
    }
  }

  const removeDocument = (filename) => {
    setDocuments(prev => prev.filter(doc => doc.filename !== filename))
  }

  return (
    <div className="app">
      <header className="app-header" style={{
        backgroundColor: '#2563eb',
        color: 'white', 
        padding: '20px',
        textAlign: 'center'
      }}>
        <h1>🧠 My Second Brain</h1>
        <p>Upload your knowledge, ask intelligent questions</p>
      </header>

      <div className="main-container" style={{
        display: 'flex',
        padding: '20px',
        gap: '20px',
        maxWidth: '1200px',
        margin: '0 auto'
      }}>
        {/* File Upload Section */}
        <div className="upload-section" style={{
          flex: '1',
          backgroundColor: 'white',
          padding: '20px',
          borderRadius: '10px',
          boxShadow: '0 2px 10px rgba(0,0,0,0.1)'
        }}>
          <h3 style={{ color: '#333' }}>📁 Upload Documents</h3>
          <div className="upload-area" style={{
            border: '2px dashed #ccc',
            padding: '20px',
            textAlign: 'center',
            borderRadius: '8px',
            backgroundColor: isProcessing ? '#f0f8ff' : 'transparent'
          }}>
            <input 
              type="file" 
              accept=".txt,.md" 
              multiple 
              onChange={handleFileUpload}
              disabled={isProcessing}
              style={{ margin: '10px 0' }}
            />
            <p style={{ color: '#666' }}>
              {isProcessing ? 'Processing & categorizing files...' : 'Upload .txt or .md files'}
            </p>
          </div>

          {/* Category Filter */}
          <div style={{ margin: '20px 0' }}>
            <h4 style={{ color: '#333', marginBottom: '10px' }}>Filter by Category:</h4>
            <select 
              value={selectedCategory} 
              onChange={(e) => setSelectedCategory(e.target.value)}
              style={{ 
                width: '100%', 
                padding: '8px', 
                borderRadius: '4px', 
                border: '1px solid #ccc' 
              }}
            >
              <option value="ALL">🌟 All Categories ({documents.length})</option>
              {Object.entries(CATEGORIES).map(([key, cat]) => {
                const count = documents.filter(doc => doc.category === key).length
                return (
                  <option key={key} value={key}>
                    {cat.emoji} {key} ({count})
                  </option>
                )
              })}
            </select>
          </div>
          
          <div className="document-list">
            <h4 style={{ color: '#333' }}>
              {selectedCategory === 'ALL' 
                ? `All Documents: ${documents.length}` 
                : `${selectedCategory}: ${filteredDocuments.length}`}
            </h4>
            {filteredDocuments.map((doc, index) => (
              <div key={index} style={{
                backgroundColor: '#f8f9fa',
                padding: '15px',
                margin: '8px 0',
                borderRadius: '8px',
                borderLeft: `4px solid ${CATEGORIES[doc.category]?.color || '#2563eb'}`
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', marginBottom: '5px' }}>
                      <span style={{ fontSize: '18px', marginRight: '8px' }}>
                        {CATEGORIES[doc.category]?.emoji || '📄'}
                      </span>
                      <strong style={{ color: '#333' }}>{doc.filename}</strong>
                    </div>
                    <div style={{ marginBottom: '8px' }}>
                      <select 
                        value={doc.category} 
                        onChange={(e) => updateDocumentCategory(doc.filename, e.target.value)}
                        style={{ 
                          padding: '4px 8px', 
                          borderRadius: '4px', 
                          border: '1px solid #ccc',
                          fontSize: '12px',
                          backgroundColor: CATEGORIES[doc.category]?.color || '#f0f0f0',
                          color: 'white'
                        }}
                      >
                        {Object.entries(CATEGORIES).map(([key, cat]) => (
                          <option key={key} value={key} style={{ color: 'black' }}>
                            {cat.emoji} {key}
                          </option>
                        ))}
                      </select>
                    </div>
                    <small style={{ color: '#666' }}>
                      {doc.chunks.length} chunks • {(doc.size / 1024).toFixed(1)}KB
                    </small>
                  </div>
                  <button 
                    onClick={() => removeDocument(doc.filename)}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: '#dc3545',
                      cursor: 'pointer',
                      fontSize: '18px',
                      marginLeft: '10px'
                    }}
                  >
                    ✕
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Chat Section */}
        <div className="chat-section" style={{
          flex: '2',
          backgroundColor: 'white',
          padding: '20px',
          borderRadius: '10px',
          boxShadow: '0 2px 10px rgba(0,0,0,0.1)'
        }}>
          <h3 style={{ color: '#333' }}>💬 Ask Your AI Assistant</h3>
          {selectedCategory !== 'ALL' && (
            <div style={{ 
              backgroundColor: CATEGORIES[selectedCategory]?.color || '#f0f0f0',
              color: 'white',
              padding: '8px 12px',
              borderRadius: '6px',
              marginBottom: '10px',
              fontSize: '14px'
            }}>
              {CATEGORIES[selectedCategory]?.emoji} Searching in: {selectedCategory}
            </div>
          )}
          <div className="messages" style={{ 
            height: '400px', 
            overflowY: 'scroll', 
            border: '1px solid #ddd', 
            padding: '15px',
            backgroundColor: '#f9f9f9',
            borderRadius: '8px',
            marginBottom: '15px'
          }}>
            {messages.length === 0 ? (
              <p style={{ color: '#666', textAlign: 'center' }}>
                {documents.length > 0 
                  ? 'Ask me questions about your uploaded documents!' 
                  : 'Upload some documents and ask me questions about them!'}
              </p>
            ) : (
              messages.map((msg, index) => (
                <div key={index} className={`message ${msg.type}`} style={{ 
                  margin: '15px 0', 
                  padding: '15px', 
                  backgroundColor: msg.type === 'user' ? '#e3f2fd' : '#f3e5f5',
                  borderRadius: '8px',
                  borderLeft: `4px solid ${msg.type === 'user' ? '#2196f3' : '#9c27b0'}`
                }}>
                  <strong style={{ 
                    color: msg.type === 'user' ? '#1976d2' : '#7b1fa2',
                    display: 'block',
                    marginBottom: '8px'
                  }}>
                    {msg.type === 'user' ? 'You:' : 'Claude:'}
                  </strong>
                  <p style={{ 
                    margin: 0, 
                    color: '#333',
                    lineHeight: '1.5'
                  }}>
                    {msg.content}
                  </p>
                  {msg.sourceDocs && msg.sourceDocs.length > 0 && (
                    <div style={{ 
                      marginTop: '10px', 
                      fontSize: '12px', 
                      color: '#666',
                      fontStyle: 'italic'
                    }}>
                      📄 Referenced: {[...new Set(msg.sourceDocs)].join(', ')}
                    </div>
                  )}
                </div>
              ))
            )}
            {isLoading && (
              <div style={{ 
                padding: '15px', 
                fontStyle: 'italic', 
                color: '#666',
                textAlign: 'center',
                backgroundColor: '#f0f0f0',
                borderRadius: '8px'
              }}>
                Claude is thinking... 🤔
              </div>
            )}
          </div>
          
          <div className="input-area" style={{ display: 'flex', gap: '10px' }}>
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleAsk()}
              placeholder={documents.length > 0 ? "Ask about your documents..." : "Upload documents first, then ask questions!"}
              disabled={isLoading}
              style={{ 
                flex: '1',
                padding: '12px', 
                border: '2px solid #ddd',
                borderRadius: '6px',
                fontSize: '16px'
              }}
            />
            <button 
              onClick={handleAsk}
              disabled={isLoading}
              style={{ 
                padding: '12px 20px',
                backgroundColor: isLoading ? '#ccc' : '#2563eb',
                color: 'white',
                border: 'none',
                borderRadius: '6px',
                cursor: isLoading ? 'not-allowed' : 'pointer',
                fontSize: '16px'
              }}
            >
              {isLoading ? 'Thinking...' : 'Ask Claude'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default App