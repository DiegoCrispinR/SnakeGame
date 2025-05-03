// Game constants
const GRID_SIZE = 20
const GAME_SPEED = 100
const DIRECTIONS = {
  ArrowUp: { x: 0, y: -1 },
  ArrowDown: { x: 0, y: 1 },
  ArrowLeft: { x: -1, y: 0 },
  ArrowRight: { x: 1, y: 0 },
  w: { x: 0, y: -1 },
  s: { x: 0, y: 1 },
  a: { x: -1, y: 0 },
  d: { x: 1, y: 0 },
  W: { x: 0, y: -1 },
  S: { x: 0, y: 1 },
  A: { x: 0, y: -1 },
  D: { x: 1, y: 0 },
}

// DOM elements
const canvas = document.getElementById("game-canvas")
const ctx = canvas.getContext("2d")
const startBtn = document.getElementById("start-btn")
const resetBtn = document.getElementById("reset-btn")
const currentScoreElement = document.getElementById("current-score")
const highScoreElement = document.getElementById("high-score")
const leaderboardBody = document.getElementById("leaderboard-body")

// Game state
let snake = []
let food = {}
let direction = DIRECTIONS.ArrowRight
let nextDirection = DIRECTIONS.ArrowRight
let gameInterval
let gameRunning = false
let score = 0
let highScore = 0
let cellSize
let currentWeekNumber

// Supabase client initialization
const supabaseUrl = window.NEXT_PUBLIC_SUPABASE_URL || ""
const supabaseAnonKey = window.NEXT_PUBLIC_SUPABASE_ANON_KEY || ""
const supabase = supabase.createClient(supabaseUrl, supabaseAnonKey)

// Initialize the game
async function init() {
  // Calculate cell size based on canvas dimensions and grid size
  cellSize = Math.floor(canvas.width / GRID_SIZE)

  // Load high score from localStorage (still keeping local high score for offline play)
  loadHighScore()

  // Get current week number
  await getCurrentWeekNumber()

  // Load leaderboard from Supabase
  await loadLeaderboard()

  // Subscribe to real-time updates
  subscribeToLeaderboardChanges()

  // Add event listeners
  startBtn.addEventListener("click", startGame)
  resetBtn.addEventListener("click", resetGame)
  document.addEventListener("keydown", handleKeyPress)

  // Draw initial game state
  drawGame()
}

// Get current week number from server
async function getCurrentWeekNumber() {
  try {
    const { data, error } = await supabase.rpc("get_week_number")

    if (error) {
      console.error("Error getting week number:", error)
      // Fallback to client-side calculation
      currentWeekNumber = getClientSideWeekNumber()
    } else {
      currentWeekNumber = data
    }
  } catch (err) {
    console.error("Failed to get week number:", err)
    // Fallback to client-side calculation
    currentWeekNumber = getClientSideWeekNumber()
  }
}

// Client-side week number calculation as fallback
function getClientSideWeekNumber() {
  const now = new Date()
  const start = new Date(now.getFullYear(), 0, 1)
  const diff = now - start
  const oneWeek = 7 * 24 * 60 * 60 * 1000
  return Math.floor(diff / oneWeek) + 1
}

// Load high score from localStorage
function loadHighScore() {
  const savedHighScore = localStorage.getItem("snakeHighScore")
  if (savedHighScore) {
    highScore = Number.parseInt(savedHighScore)
    highScoreElement.textContent = highScore
  }
}

// Save high score to localStorage
function saveHighScore() {
  localStorage.setItem("snakeHighScore", highScore.toString())
}

// Handle key presses
function handleKeyPress(event) {
  // Prevent default behavior for arrow keys to avoid page scrolling
  if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "w", "a", "s", "d"].includes(event.key)) {
    event.preventDefault()
  }

  // Update direction if it's a valid direction and not opposite to current direction
  if (DIRECTIONS[event.key]) {
    const currentX = direction.x
    const currentY = direction.y
    const nextX = DIRECTIONS[event.key].x
    const nextY = DIRECTIONS[event.key].y

    // Prevent 180-degree turns (moving directly back on yourself)
    if (!(currentX + nextX === 0 && currentY + nextY === 0)) {
      nextDirection = DIRECTIONS[event.key]
    }
  }
}

// Start the game
function startGame() {
  if (gameRunning) return

  // Reset game state
  snake = [{ x: Math.floor(GRID_SIZE / 2), y: Math.floor(GRID_SIZE / 2) }]
  score = 0
  currentScoreElement.textContent = score
  direction = DIRECTIONS.ArrowRight
  nextDirection = DIRECTIONS.ArrowRight

  // Generate initial food
  generateFood()

  // Start game loop
  gameRunning = true
  gameInterval = setInterval(gameLoop, GAME_SPEED)

  // Update button states
  startBtn.disabled = true
}

// Reset the game
function resetGame() {
  clearInterval(gameInterval)
  gameRunning = false
  score = 0
  currentScoreElement.textContent = score
  startBtn.disabled = false

  // Reset snake and redraw
  snake = []
  drawGame()
}

// Main game loop
function gameLoop() {
  // Update direction
  direction = nextDirection

  // Move snake
  const head = { ...snake[0] }
  head.x += direction.x
  head.y += direction.y

  // Check for collisions
  if (checkCollision(head)) {
    gameOver()
    return
  }

  // Add new head
  snake.unshift(head)

  // Check if food is eaten
  if (head.x === food.x && head.y === food.y) {
    // Increase score
    score += 10
    currentScoreElement.textContent = score

    // Update high score if needed
    if (score > highScore) {
      highScore = score
      highScoreElement.textContent = highScore
      saveHighScore()
    }

    // Generate new food
    generateFood()
  } else {
    // Remove tail if no food eaten
    snake.pop()
  }

  // Draw updated game state
  drawGame()
}

// Check for collisions with walls or self
function checkCollision(position) {
  // Check wall collisions
  if (position.x < 0 || position.y < 0 || position.x >= GRID_SIZE || position.y >= GRID_SIZE) {
    return true
  }

  // Check self collision
  return snake.some((segment) => segment.x === position.x && segment.y === position.y)
}

// Generate food at random position
function generateFood() {
  let newFood
  let foodOnSnake

  // Keep generating until food is not on snake
  do {
    newFood = {
      x: Math.floor(Math.random() * GRID_SIZE),
      y: Math.floor(Math.random() * GRID_SIZE),
    }

    foodOnSnake = snake.some((segment) => segment.x === newFood.x && segment.y === newFood.y)
  } while (foodOnSnake)

  food = newFood
}

// Draw the game state
function drawGame() {
  // Clear canvas
  ctx.fillStyle = "#000000"
  ctx.fillRect(0, 0, canvas.width, canvas.height)

  // Draw snake
  snake.forEach((segment, index) => {
    // Head is a different color
    if (index === 0) {
      ctx.fillStyle = "#FFFFFF"
    } else {
      // Gradient from white to green for the body
      const greenValue = Math.floor(200 - index * 15)
      ctx.fillStyle = `rgb(${greenValue}, 255, ${greenValue})`
    }

    ctx.fillRect(segment.x * cellSize, segment.y * cellSize, cellSize - 1, cellSize - 1)
  })

  // Draw food
  ctx.fillStyle = "#FF0000"
  ctx.fillRect(food.x * cellSize, food.y * cellSize, cellSize - 1, cellSize - 1)

  // Draw grid (optional, for a more defined look)
  ctx.strokeStyle = "#333333"
  ctx.lineWidth = 0.5

  // Draw vertical grid lines
  for (let i = 0; i <= GRID_SIZE; i++) {
    ctx.beginPath()
    ctx.moveTo(i * cellSize, 0)
    ctx.lineTo(i * cellSize, canvas.height)
    ctx.stroke()
  }

  // Draw horizontal grid lines
  for (let i = 0; i <= GRID_SIZE; i++) {
    ctx.beginPath()
    ctx.moveTo(0, i * cellSize)
    ctx.lineTo(canvas.width, i * cellSize)
    ctx.stroke()
  }
}

// Game over function
async function gameOver() {
  clearInterval(gameInterval)
  gameRunning = false
  startBtn.disabled = false

  // Add score to leaderboard if it's high enough
  if (score > 0) {
    await addScoreToLeaderboard(score)
  }

  // Show game over message
  ctx.fillStyle = "rgba(0, 0, 0, 0.75)"
  ctx.fillRect(0, 0, canvas.width, canvas.height)

  ctx.font = "30px Arial"
  ctx.fillStyle = "#FFFFFF"
  ctx.textAlign = "center"
  ctx.fillText("Game Over!", canvas.width / 2, canvas.height / 2 - 30)

  ctx.font = "20px Arial"
  ctx.fillText(`Score: ${score}`, canvas.width / 2, canvas.height / 2 + 10)

  if (score === highScore && score > 0) {
    ctx.fillStyle = "#FFD700"
    ctx.fillText("New High Score!", canvas.width / 2, canvas.height / 2 + 40)
  }
}

// Subscribe to real-time leaderboard changes
function subscribeToLeaderboardChanges() {
  supabase
    .channel("snake_scores_changes")
    .on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: "snake_scores",
        filter: `week_number=eq.${currentWeekNumber}`,
      },
      (payload) => {
        // Reload leaderboard when changes occur
        loadLeaderboard()
      },
    )
    .subscribe()
}

// Leaderboard functions
async function loadLeaderboard() {
  try {
    // Get top 10 scores for current week
    const { data, error } = await supabase
      .from("snake_scores")
      .select("*")
      .eq("week_number", currentWeekNumber)
      .order("score", { ascending: false })
      .limit(10)

    if (error) {
      console.error("Error loading leaderboard:", error)
      return
    }

    updateLeaderboardDisplay(data || [])
  } catch (err) {
    console.error("Failed to load leaderboard:", err)
  }
}

async function addScoreToLeaderboard(score) {
  if (score === 0) return

  try {
    // Get player name
    const playerName = prompt("Enter your name for the leaderboard:") || "Anonymous"

    // Insert score into database
    const { error } = await supabase.from("snake_scores").insert([
      {
        player_name: playerName,
        score: score,
        week_number: currentWeekNumber,
      },
    ])

    if (error) {
      console.error("Error adding score:", error)
    }

    // Leaderboard will update automatically via subscription
  } catch (err) {
    console.error("Failed to add score:", err)
  }
}

function updateLeaderboardDisplay(leaderboard) {
  // Clear current leaderboard
  leaderboardBody.innerHTML = ""

  // Add entries
  leaderboard.forEach((entry, index) => {
    const row = document.createElement("tr")

    // Format date
    const date = new Date(entry.created_at)
    const formattedDate = `${date.getDate()}/${date.getMonth() + 1}/${date.getFullYear()}`

    row.innerHTML = `
            <td>${index + 1}</td>
            <td>${escapeHTML(entry.player_name)}</td>
            <td>${entry.score}</td>
            <td>${formattedDate}</td>
        `

    leaderboardBody.appendChild(row)
  })

  // Add empty rows if less than 10 entries
  for (let i = leaderboard.length; i < 10; i++) {
    const row = document.createElement("tr")
    row.innerHTML = `
            <td>${i + 1}</td>
            <td>-</td>
            <td>-</td>
            <td>-</td>
        `
    leaderboardBody.appendChild(row)
  }
}

// Security function - Escape HTML to prevent XSS
function escapeHTML(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;")
}

// Initialize the game when the page loads
window.addEventListener("load", init)

// Prevent context menu on right-click
canvas.addEventListener("contextmenu", (e) => {
  e.preventDefault()
  return false
})
