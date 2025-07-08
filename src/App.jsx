import { useState, useEffect } from 'react'
import Anthropic from '@anthropic-ai/sdk'
import './App.css'

// Initialize Claude
const anthropic = new Anthropic({
  apiKey: import.meta.env.VITE_CLAUDE_API_KEY,
  dangerouslyAllowBrowser: true
})

// Our smart categorization system
const CATEGORIES = {
  'PROJECTS': { emoji: '📋', color: '#ff6b6b', description: 'Active work with deadlines' },
  'CAREER': { emoji: '💼', color: '#4ecdc4', description: 'Professional growth & work' },
  'HEALTH': { emoji: '🏃‍♂️', color: '#45b7d1', description: 'Physical & mental wellness' },
  'RELATIONSHIPS': { emoji: '❤️', color: '#f9ca24', description: 'Family, friends, romance' },
  'FINANCES': { emoji: '💰', color: '#6c5ce7', description: 'Money, investing, budgeting' },
  'LEARNING': { emoji: '📚', color: '#a29bfe', description: 'Education, skills, growth' },
  'RECREATION': { emoji: '🎉', color: '#fd79a8', description: 'Hobbies, fun, entertainment' },
  'ENVIRONMENT': { emoji: '🏠', color: '#00b894', description: 'Home, workspace, surroundings' },
  'RESOURCES': { emoji: '🗄️', color: '#636e72', description: 'Reference materials' },
  'ARCHIVE': { emoji: '📁', color: '#b2bec3', description: 'Completed or inactive' }
}

// Default coaching settings
const DEFAULT_COACHING_SETTINGS = {
  alignmentPrinciples: [
    "Prioritize long-term wellbeing over short-term comfort",
    "Challenge decisions that don't serve authentic goals", 
    "Connect actions across domains to show systemic impact",
    "Provide honest feedback even when uncomfortable",
    "Support self-advocacy and boundary setting"
  ],
  communicationStyle: {
    directnessLevel: 8,
    challengeApproach: 8,
    supportStyle: "solution-focused with emotional awareness",
    feedbackMethod: "specific, actionable, data-driven when possible"
  },
  responsePersonality: {
    solutionFocused: true,
    emotionallyAware: true,
    datadriven: true,
    challenging: true,
    supportive: true
  }
}

// Storage keys
const STORAGE_KEYS = {
  DOCUMENTS: 'secondBrain_documents',
  MESSAGES: 'secondBrain_messages',
  COACHING_SETTINGS: 'secondBrain_coachingSettings'
}

function App() {
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [documents, setDocuments] = useState([])
  const [isLoading, setIsLoading] = useState(false)
  const [isProcessing, setIsProcessing] = useState(false)
  const [selectedCategory, setSelectedCategory] = useState('ALL')
  const [activeTab, setActiveTab] = useState('knowledge')
  const [coachingSettings, setCoachingSettings] = useState(DEFAULT_COACHING_SETTINGS)

  // Load saved data when app starts
  useEffect(() => {
    loadSavedData()
  }, [])

  // Save data whenever it changes
  useEffect(() => {
    if (documents.length > 0) {
      localStorage.setItem(STORAGE_KEYS.DOCUMENTS, JSON.stringify(documents))
    }
  }, [documents])

  useEffect(() => {
    if (messages.length > 0) {
      localStorage.setItem(STORAGE_KEYS.MESSAGES, JSON.stringify(messages))
    }
  }, [messages])

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.COACHING_SETTINGS, JSON.stringify(coachingSettings))
  }, [coachingSettings])

  // Load data from localStorage
  const loadSavedData = () => {
    try {
      const savedDocuments = localStorage.getItem(STORAGE_KEYS.DOCUMENTS)
      const savedMessages = localStorage.getItem(STORAGE_KEYS.MESSAGES)
      const savedCoachingSettings = localStorage.getItem(STORAGE_KEYS.COACHING_SETTINGS)
      
      if (savedDocuments) setDocuments(JSON.parse(savedDocuments))
      if (savedMessages) setMessages(JSON.parse(savedMessages))
      if (savedCoachingSettings) {
        setCoachingSettings(JSON.parse(savedCoachingSettings))
      }
    } catch (error) {
      console.error('Error loading saved data:', error)
    }
  }

  // Clear all data
  const clearAllData = () => {
    if (confirm('Are you sure you want to clear all documents and messages? This cannot be undone.')) {
      localStorage.removeItem(STORAGE_KEYS.DOCUMENTS)
      localStorage.removeItem(STORAGE_KEYS.MESSAGES)
      setDocuments([])
      setMessages([])
    }
  }

  // Create personalized coaching prompt
  const createCoachingPrompt = (question, relevantChunks) => {
    const { alignmentPrinciples, communicationStyle, responsePersonality } = coachingSettings
    
    let basePrompt = `You are a personalized AI life coach with access to the user's knowledge base. You must adapt your responses according to their specific alignment principles and communication preferences.

USER'S ALIGNMENT PRINCIPLES:
${alignmentPrinciples.map((principle, index) => `${index + 1}. ${principle}`).join('\n')}

COMMUNICATION STYLE PREFERENCES:
- Directness Level: ${communicationStyle.directnessLevel}/10 ${communicationStyle.directnessLevel > 7 ? '(Be very direct and blunt about problems)' : communicationStyle.directnessLevel > 4 ? '(Be moderately direct)' : '(Be gentle and diplomatic)'}
- Challenge Approach: ${communicationStyle.challengeApproach}/10 ${communicationStyle.challengeApproach > 7 ? '(Strongly challenge poor decisions)' : communicationStyle.challengeApproach > 4 ? '(Gently question decisions)' : '(Be supportive and encouraging)'}
- Support Style: ${communicationStyle.supportStyle}
- Feedback Method: ${communicationStyle.feedbackMethod}

RESPONSE PERSONALITY TRAITS:
${Object.entries(responsePersonality).filter(([key, value]) => value).map(([key]) => `- ${key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase())}`).join('\n')}

`

    if (relevantChunks.length > 0) {
      basePrompt += `RELEVANT KNOWLEDGE FROM USER'S DOCUMENTS:
${relevantChunks.map((chunk, index) => 
  `Document "${chunk.filename}" (Section ${index + 1}):\n${chunk.content}`
).join('\n\n---\n\n')}

`
    }

    basePrompt += `USER'S QUESTION: ${question}

Respond as a personalized coach who knows this user's values and communication preferences. Reference their alignment principles when relevant, use their preferred communication style, and provide guidance that truly serves their authentic goals. Be honest and direct according to their preferences, even if uncomfortable.`

    return basePrompt
  }

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
      return 'RESOURCES'
    }
  }

  // Process uploaded files with AI categorization
  const processFile = async (file) => {
    return new Promise(async (resolve) => {
      const reader = new FileReader()
      reader.onload = async (e) => {
        const content = e.target.result
        
        const category = await categorizeDocument(file.name, content)
        
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
          if (!documents.find(doc => doc.filename === file.name)) {
            const processedDoc = await processFile(file)
            setDocuments(prev => [...prev, processedDoc])
          }
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

  // Ask Claude with personalized coaching
  const askClaude = async (question) => {
    setIsLoading(true)
    
    try {
      const relevantChunks = findRelevantChunks(question)
      const prompt = createCoachingPrompt(question, relevantChunks)

      const response = await anthropic.messages.create({
        model: "claude-3-5-sonnet-20241022",
        max_tokens: 1000,
        messages: [{ role: "user", content: prompt }]
      })
      
      const aiResponse = response.content[0].text
      
      setMessages(prev => [...prev, 
        { 
          type: 'user', 
          content: question,
          timestamp: new Date().toISOString()
        },
        { 
          type: 'ai', 
          content: aiResponse,
          sourceDocs: relevantChunks.map(chunk => chunk.filename),
          timestamp: new Date().toISOString(),
          usedPersonalization: true
        }
      ])
    } catch (error) {
      console.error('Error:', error)
      setMessages(prev => [...prev, 
        { type: 'user', content: question, timestamp: new Date().toISOString() },
        { type: 'ai', content: 'Sorry, I encountered an error. Please try again.', timestamp: new Date().toISOString() }
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

  // Add new alignment principle
  const addAlignmentPrinciple = () => {
    setCoachingSettings(prev => ({
      ...prev,
      alignmentPrinciples: [...prev.alignmentPrinciples, "New principle..."]
    }))
  }

  // Remove alignment principle
  const removeAlignmentPrinciple = (index) => {
    setCoachingSettings(prev => ({
      ...prev,
      alignmentPrinciples: prev.alignmentPrinciples.filter((_, i) => i !== index)
    }))
  }

  // Settings tab render function with comprehensive guidance
const renderSettingsTab = () => (
  <div style={{ padding: '20px' }}>
    <h3 style={{ color: '#333', marginBottom: '20px' }}>🎯 Personal Coaching Settings</h3>
    
    {/* Guidance Section */}
    <div style={{
      backgroundColor: '#f8f9ff',
      border: '1px solid #e3f2fd',
      borderRadius: '12px',
      padding: '20px',
      marginBottom: '30px'
    }}>
      <h4 style={{ color: '#1976d2', marginTop: 0, marginBottom: '15px' }}>
        💡 What Are Alignment Principles?
      </h4>
      <p style={{ color: '#333', lineHeight: '1.6', marginBottom: '15px' }}>
        Alignment principles are your personal values and guidelines that help you make decisions consistent with your authentic goals. 
        They act as a filter for opportunities, relationships, and choices in your life.
      </p>
      
      <div style={{ 
        display: 'grid', 
        gridTemplateColumns: '1fr 1fr', 
        gap: '20px', 
        marginBottom: '15px' 
      }}>
        <div>
          <h5 style={{ color: '#1976d2', marginBottom: '8px' }}>📋 Example Categories:</h5>
          <ul style={{ margin: 0, paddingLeft: '20px', color: '#666', fontSize: '14px' }}>
            <li><strong>Values:</strong> "Prioritize authenticity over approval"</li>
            <li><strong>Growth:</strong> "Choose discomfort that leads to learning"</li>
            <li><strong>Relationships:</strong> "Invest in people who reciprocate energy"</li>
            <li><strong>Work:</strong> "Align projects with long-term vision"</li>
            <li><strong>Health:</strong> "Treat rest as productive, not lazy"</li>
          </ul>
        </div>
        
        <div>
          <h5 style={{ color: '#1976d2', marginBottom: '8px' }}>✨ Tips for Great Principles:</h5>
          <ul style={{ margin: 0, paddingLeft: '20px', color: '#666', fontSize: '14px' }}>
            <li>Be specific and actionable</li>
            <li>Focus on what matters most to YOU</li>
            <li>Make them challenging but achievable</li>
            <li>Use your own language and voice</li>
            <li>Test them against real decisions</li>
          </ul>
        </div>
      </div>
      
      <div style={{
        backgroundColor: '#e8f5e8',
        padding: '12px',
        borderRadius: '6px',
        border: '1px solid #c8e6c9'
      }}>
        <strong style={{ color: '#2e7d32' }}>Why This Works:</strong>
        <span style={{ color: '#2e7d32', fontSize: '14px', marginLeft: '8px' }}>
          Your AI coach uses these principles to give you advice that's truly aligned with YOUR values, 
          not generic guidance. The more specific and personal your principles, the better your coaching will be.
        </span>
      </div>
    </div>

    {/* Alignment Principles Section */}
    <div style={{ marginBottom: '30px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
        <h4 style={{ color: '#333', margin: 0 }}>Your Alignment Principles</h4>
        <div style={{ display: 'flex', gap: '10px' }}>
          <button
            onClick={() => {
              setCoachingSettings(prev => ({
                ...prev,
                alignmentPrinciples: [...DEFAULT_COACHING_SETTINGS.alignmentPrinciples]
              }))
            }}
            style={{
              padding: '5px 10px',
              fontSize: '12px',
              backgroundColor: '#17a2b8',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer'
            }}
          >
            🔄 Load Examples
          </button>
          <button
            onClick={addAlignmentPrinciple}
            style={{
              padding: '5px 10px',
              fontSize: '12px',
              backgroundColor: '#28a745',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer'
            }}
          >
            + Add Principle
          </button>
        </div>
      </div>
      <p style={{ color: '#666', fontSize: '14px', marginBottom: '15px' }}>
        These core principles will guide how your AI coach provides advice and challenges your decisions.
      </p>
      {coachingSettings.alignmentPrinciples.map((principle, index) => (
        <div key={index} style={{ 
          display: 'flex', 
          alignItems: 'center', 
          marginBottom: '10px',
          padding: '12px',
          backgroundColor: '#f8f9fa',
          borderRadius: '8px',
          borderLeft: '4px solid #2563eb'
        }}>
          <span style={{ marginRight: '12px', fontWeight: 'bold', color: '#2563eb', minWidth: '25px' }}>
            {index + 1}.
          </span>
          <input
            type="text"
            value={principle}
            onChange={(e) => {
              const newPrinciples = [...coachingSettings.alignmentPrinciples]
              newPrinciples[index] = e.target.value
              setCoachingSettings(prev => ({
                ...prev,
                alignmentPrinciples: newPrinciples
              }))
            }}
            placeholder="Enter your alignment principle..."
            style={{
              flex: 1,
              border: 'none',
              background: 'transparent',
              fontSize: '14px',
              padding: '8px',
              color: '#333'
            }}
          />
          {coachingSettings.alignmentPrinciples.length > 1 && (
            <button
              onClick={() => removeAlignmentPrinciple(index)}
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
          )}
        </div>
      ))}
    </div>

    {/* Communication Style Section */}
    <div style={{ marginBottom: '30px' }}>
      <h4 style={{ color: '#333', marginBottom: '15px' }}>Communication Style Preferences</h4>
      <p style={{ color: '#666', fontSize: '14px', marginBottom: '20px' }}>
        Adjust how your AI coach communicates with you. Higher values = more direct and challenging.
      </p>
      
      <div style={{ marginBottom: '25px' }}>
        <label style={{ display: 'block', marginBottom: '8px', fontWeight: '500' }}>
          Directness Level: {coachingSettings.communicationStyle.directnessLevel}/10
          <span style={{ marginLeft: '10px', fontSize: '14px', color: '#666' }}>
            {coachingSettings.communicationStyle.directnessLevel > 7 ? '(Very direct and blunt)' : 
             coachingSettings.communicationStyle.directnessLevel > 4 ? '(Moderately direct)' : 
             '(Gentle and diplomatic)'}
          </span>
        </label>
        <input
          type="range"
          min="1"
          max="10"
          value={coachingSettings.communicationStyle.directnessLevel}
          onChange={(e) => setCoachingSettings(prev => ({
            ...prev,
            communicationStyle: {
              ...prev.communicationStyle,
              directnessLevel: parseInt(e.target.value)
            }
          }))}
          style={{ width: '100%', marginBottom: '8px' }}
        />
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: '#999' }}>
          <span>1 - Gentle & diplomatic</span>
          <span>10 - Very direct & blunt</span>
        </div>
      </div>

      <div style={{ marginBottom: '25px' }}>
        <label style={{ display: 'block', marginBottom: '8px', fontWeight: '500' }}>
          Challenge Approach: {coachingSettings.communicationStyle.challengeApproach}/10
          <span style={{ marginLeft: '10px', fontSize: '14px', color: '#666' }}>
            {coachingSettings.communicationStyle.challengeApproach > 7 ? '(Strongly challenge decisions)' : 
             coachingSettings.communicationStyle.challengeApproach > 4 ? '(Gently question decisions)' : 
             '(Supportive and encouraging)'}
          </span>
        </label>
        <input
          type="range"
          min="1"
          max="10"
          value={coachingSettings.communicationStyle.challengeApproach}
          onChange={(e) => setCoachingSettings(prev => ({
            ...prev,
            communicationStyle: {
              ...prev.communicationStyle,
              challengeApproach: parseInt(e.target.value)
            }
          }))}
          style={{ width: '100%', marginBottom: '8px' }}
        />
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: '#999' }}>
          <span>1 - Supportive & encouraging</span>
          <span>10 - Strongly challenge decisions</span>
        </div>
      </div>

      <div style={{ marginBottom: '20px' }}>
        <label style={{ display: 'block', marginBottom: '8px', fontWeight: '500' }}>
          Support Style:
        </label>
        <input
          type="text"
          value={coachingSettings.communicationStyle.supportStyle}
          onChange={(e) => setCoachingSettings(prev => ({
            ...prev,
            communicationStyle: {
              ...prev.communicationStyle,
              supportStyle: e.target.value
            }
          }))}
          placeholder="e.g., solution-focused with emotional awareness"
          style={{
            width: '100%',
            padding: '10px',
            border: '1px solid #ddd',
            borderRadius: '6px'
          }}
        />
      </div>

      <div style={{ marginBottom: '20px' }}>
        <label style={{ display: 'block', marginBottom: '8px', fontWeight: '500' }}>
          Feedback Method:
        </label>
        <input
          type="text"
          value={coachingSettings.communicationStyle.feedbackMethod}
          onChange={(e) => setCoachingSettings(prev => ({
            ...prev,
            communicationStyle: {
              ...prev.communicationStyle,
              feedbackMethod: e.target.value
            }
          }))}
          placeholder="e.g., specific, actionable, data-driven when possible"
          style={{
            width: '100%',
            padding: '10px',
            border: '1px solid #ddd',
            borderRadius: '6px'
          }}
        />
      </div>
    </div>

    {/* Test Your Settings */}
    <div style={{
      backgroundColor: '#e3f2fd',
      padding: '20px',
      borderRadius: '12px',
      marginTop: '20px'
    }}>
      <h4 style={{ color: '#1976d2', margin: '0 0 12px 0' }}>🚀 Ready to Test Your Personalized Coach?</h4>
      <p style={{ color: '#1976d2', fontSize: '14px', margin: '0 0 12px 0' }}>
        Go to the "AI Coach" tab and ask about goals, decisions, or challenges. 
        Your coach will respond according to your personalized settings!
      </p>
      <div style={{ 
        backgroundColor: 'rgba(255,255,255,0.5)', 
        padding: '12px', 
        borderRadius: '6px',
        fontSize: '12px',
        color: '#1976d2'
      }}>
        <strong>💡 Try questions like:</strong><br/>
        • "Should I take on this opportunity that conflicts with my values?"<br/>
        • "How should I handle this difficult conversation?"<br/>
        • "I'm avoiding making an important decision - help me!"
      </div>
    </div>
  </div>
)
  return (
    <div className="app">
      <header className="app-header" style={{
        backgroundColor: '#2563eb',
        color: 'white', 
        padding: '20px',
        textAlign: 'center'
      }}>
        <h1>🧠 My Second Brain</h1>
        <p>Upload your knowledge, get personalized coaching</p>
        <div style={{ fontSize: '14px', opacity: 0.8, marginTop: '10px' }}>
          📊 {documents.length} documents • 💬 {messages.length} messages • 🎯 Personalized AI Coach • 💾 Auto-saved
        </div>
      </header>

      <div className="main-container" style={{
        maxWidth: '1200px',
        margin: '0 auto',
        padding: '20px'
      }}>
        {/* Tab Navigation */}
        <div style={{
          display: 'flex',
          borderBottom: '2px solid #e5e7eb',
          marginBottom: '20px'
        }}>
          <button
            onClick={() => setActiveTab('knowledge')}
            style={{
              padding: '15px 25px',
              border: 'none',
              backgroundColor: activeTab === 'knowledge' ? '#2563eb' : 'transparent',
              color: activeTab === 'knowledge' ? 'white' : '#666',
              cursor: 'pointer',
              borderRadius: '8px 8px 0 0',
              marginRight: '5px',
              fontWeight: '500'
            }}
          >
            📁 Knowledge Base ({documents.length})
          </button>
          <button
            onClick={() => setActiveTab('conversations')}
            style={{
              padding: '15px 25px',
              border: 'none',
              backgroundColor: activeTab === 'conversations' ? '#2563eb' : 'transparent',
              color: activeTab === 'conversations' ? 'white' : '#666',
              cursor: 'pointer',
              borderRadius: '8px 8px 0 0',
              marginRight: '5px',
              fontWeight: '500'
            }}
          >
            💬 AI Coach ({Math.floor(messages.length / 2)})
          </button>
          <button
            onClick={() => setActiveTab('settings')}
            style={{
              padding: '15px 25px',
              border: 'none',
              backgroundColor: activeTab === 'settings' ? '#2563eb' : 'transparent',
              color: activeTab === 'settings' ? 'white' : '#666',
              cursor: 'pointer',
              borderRadius: '8px 8px 0 0',
              fontWeight: '500'
            }}
          >
            🎯 Coaching Settings
          </button>
        </div>

        {/* Tab Content */}
        <div style={{
          backgroundColor: 'white',
          borderRadius: '10px',
          boxShadow: '0 2px 10px rgba(0,0,0,0.1)',
          minHeight: '600px'
        }}>
          
          {/* Settings Tab */}
          {activeTab === 'settings' && renderSettingsTab()}
          
          {/* Knowledge Base Tab */}
          {activeTab === 'knowledge' && (
            <div style={{ padding: '20px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                <h3 style={{ color: '#333', margin: 0 }}>📁 Upload Documents</h3>
                <button
                  onClick={clearAllData}
                  style={{
                    padding: '8px 15px',
                    fontSize: '14px',
                    backgroundColor: '#dc3545',
                    color: 'white',
                    border: 'none',
                    borderRadius: '6px',
                    cursor: 'pointer'
                  }}
                >
                  Clear All Data
                </button>
              </div>
              
              <div style={{
                border: '2px dashed #ccc',
                padding: '30px',
                textAlign: 'center',
                borderRadius: '8px',
                backgroundColor: isProcessing ? '#f0f8ff' : 'transparent',
                marginBottom: '20px'
              }}>
                <input 
                  type="file" 
                  accept=".txt,.md" 
                  multiple 
                  onChange={handleFileUpload}
                  disabled={isProcessing}
                  style={{ margin: '10px 0' }}
                />
                <p style={{ color: '#666', margin: '10px 0' }}>
                  {isProcessing ? 'Processing & categorizing files...' : 'Upload .txt or .md files'}
                </p>
              </div>

              {/* Category Filter */}
              <div style={{ marginBottom: '20px' }}>
                <h4 style={{ color: '#333', marginBottom: '10px' }}>Filter by Category:</h4>
                <select 
                  value={selectedCategory} 
                  onChange={(e) => setSelectedCategory(e.target.value)}
                  style={{ 
                    width: '100%', 
                    padding: '10px', 
                    borderRadius: '6px', 
                    border: '1px solid #ccc',
                    fontSize: '16px'
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
                    margin: '10px 0',
                    borderRadius: '8px',
                    borderLeft: `4px solid ${CATEGORIES[doc.category]?.color || '#2563eb'}`
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <div style={{ flex: 1 }}>
                        <div style={{ display: 'flex', alignItems: 'center', marginBottom: '8px' }}>
                          <span style={{ fontSize: '20px', marginRight: '10px' }}>
                            {CATEGORIES[doc.category]?.emoji || '📄'}
                          </span>
                          <strong style={{ color: '#333', fontSize: '16px' }}>{doc.filename}</strong>
                        </div>
                        <div style={{ marginBottom: '8px' }}>
                          <select 
                            value={doc.category} 
                            onChange={(e) => updateDocumentCategory(doc.filename, e.target.value)}
                            style={{ 
                              padding: '6px 10px', 
                              borderRadius: '4px', 
                              border: '1px solid #ccc',
                              fontSize: '14px',
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
                          fontSize: '20px',
                          marginLeft: '15px'
                        }}
                      >
                        ✕
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Conversations Tab */}
          {activeTab === 'conversations' && (
            <div style={{ padding: '20px' }}>
              <h3 style={{ color: '#333', marginBottom: '20px' }}>💬 Your Personalized AI Coach</h3>
              
              {selectedCategory !== 'ALL' && (
                <div style={{ 
                  backgroundColor: CATEGORIES[selectedCategory]?.color || '#f0f0f0',
                  color: 'white',
                  padding: '10px 15px',
                  borderRadius: '6px',
                  marginBottom: '15px',
                  fontSize: '14px'
                }}>
                  {CATEGORIES[selectedCategory]?.emoji} Searching in: {selectedCategory} documents
                </div>
              )}
              
              <div style={{ 
                height: '400px', 
                overflowY: 'scroll',
border: '1px solid #ddd', 
               padding: '20px',
               backgroundColor: '#f9f9f9',
               borderRadius: '8px',
               marginBottom: '20px'
             }}>
               {messages.length === 0 ? (
                 <div style={{ textAlign: 'center', color: '#666', padding: '50px 20px' }}>
                   <h4>Welcome to Your Personalized AI Coach! 🎯</h4>
                   <p>
                     {documents.length > 0 
                       ? 'Ask me questions about your goals, decisions, or challenges. I\'ll respond according to your personalized coaching settings!' 
                       : 'Upload some documents first, then ask me questions!'}
                   </p>
                   <div style={{ fontSize: '14px', marginTop: '15px', padding: '15px', backgroundColor: '#e3f2fd', borderRadius: '6px' }}>
                     <strong>💡 Try asking:</strong><br/>
                     • "Should I take on this new project?"<br/>
                     • "How should I handle a difficult conversation?"<br/>
                     • "What's my next step for career growth?"
                   </div>
                 </div>
               ) : (
                 messages.map((msg, index) => (
                   <div key={index} style={{ 
                     margin: '20px 0', 
                     padding: '20px', 
                     backgroundColor: msg.type === 'user' ? '#e3f2fd' : '#f3e5f5',
                     borderRadius: '12px',
                     borderLeft: `4px solid ${msg.type === 'user' ? '#2196f3' : '#9c27b0'}`
                   }}>
                     <div style={{ 
                       display: 'flex',
                       justifyContent: 'space-between',
                       alignItems: 'center',
                       marginBottom: '10px'
                     }}>
                       <strong style={{ 
                         color: msg.type === 'user' ? '#1976d2' : '#7b1fa2',
                         fontSize: '16px'
                       }}>
                         {msg.type === 'user' ? 'You:' : '🎯 Your Personal Coach:'}
                       </strong>
                       {msg.usedPersonalization && (
                         <span style={{
                           fontSize: '12px',
                           backgroundColor: '#4caf50',
                           color: 'white',
                           padding: '2px 8px',
                           borderRadius: '10px'
                         }}>
                           Personalized
                         </span>
                       )}
                     </div>
                     <p style={{ 
                       margin: 0, 
                       color: '#333',
                       lineHeight: '1.6',
                       fontSize: '15px'
                     }}>
                       {msg.content}
                     </p>
                     {msg.sourceDocs && msg.sourceDocs.length > 0 && (
                       <div style={{ 
                         marginTop: '15px', 
                         fontSize: '12px', 
                         color: '#666',
                         fontStyle: 'italic',
                         padding: '8px',
                         backgroundColor: 'rgba(255,255,255,0.5)',
                         borderRadius: '4px'
                       }}>
                         📄 Referenced documents: {[...new Set(msg.sourceDocs)].join(', ')}
                       </div>
                     )}
                   </div>
                 ))
               )}
               {isLoading && (
                 <div style={{ 
                   padding: '20px', 
                   fontStyle: 'italic', 
                   color: '#666',
                   textAlign: 'center',
                   backgroundColor: '#f0f0f0',
                   borderRadius: '8px'
                 }}>
                   🎯 Your personal coach is thinking... 🤔
                 </div>
               )}
             </div>
             
             <div style={{ display: 'flex', gap: '15px' }}>
               <input
                 type="text"
                 value={input}
                 onChange={(e) => setInput(e.target.value)}
                 onKeyPress={(e) => e.key === 'Enter' && handleAsk()}
                 placeholder={documents.length > 0 ? "Ask your personal coach about goals, decisions, or challenges..." : "Upload documents first, then ask questions!"}
                 disabled={isLoading}
                 style={{ 
                   flex: '1',
                   padding: '15px', 
                   border: '2px solid #ddd',
                   borderRadius: '8px',
                   fontSize: '16px'
                 }}
               />
               <button 
                 onClick={handleAsk}
                 disabled={isLoading || !input.trim()}
                 style={{ 
                   padding: '15px 25px',
                   backgroundColor: isLoading || !input.trim() ? '#ccc' : '#2563eb',
                   color: 'white',
                   border: 'none',
                   borderRadius: '8px',
                   cursor: isLoading || !input.trim() ? 'not-allowed' : 'pointer',
                   fontSize: '16px',
                   fontWeight: '500'
                 }}
               >
                 {isLoading ? 'Coaching...' : 'Ask Coach'}
               </button>
             </div>
           </div>
         )}
       </div>
     </div>
   </div>
 )
}

export default App