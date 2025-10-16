import mongoose from 'mongoose';

// Connection state interface
interface ConnectionState {
  isConnected: boolean;
  isConnecting: boolean;
  connectionPromise: Promise<typeof mongoose> | null;
  connectionAttempts: number;
  lastConnectionTime: Date | null;
  lastError: Error | null;
}

// Initialize connection state
const connectionState: ConnectionState = {
  isConnected: false,
  isConnecting: false,
  connectionPromise: null,
  connectionAttempts: 0,
  lastConnectionTime: null,
  lastError: null
};

// Maximum connection attempts
const MAX_CONNECTION_ATTEMPTS = 5;
const CONNECTION_RETRY_DELAY = 5000; // 5 seconds

/**
 * Get MongoDB URI from environment with fallback
 */
const getMongoURI = (): string => {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    throw new Error('MONGODB_URI environment variable is required');
  }
  return uri;
};

/**
 * Optimized connection options for production use
 */
const getConnectionOptions = () => {
  return {
    // Connection Pool Settings - Optimized for MongoDB Atlas
    maxPoolSize: 10,          // Maximum 10 connections (suitable for Atlas free tier)
    minPoolSize: 1,           // Keep minimum 1 connection open
    maxIdleTimeMS: 30000,     // Close connections after 30 seconds of inactivity
    maxConnecting: 2,         // Maximum 2 connections connecting at once
    
    // Timeout Settings
    serverSelectionTimeoutMS: 5000,  // How long to try to connect to a server
    socketTimeoutMS: 45000,          // How long to wait for a response
    connectTimeoutMS: 10000,         // How long to wait for initial connection
    
    // Heartbeat and Monitoring
    heartbeatFrequencyMS: 10000,     // How often to check server status
    
    // Buffer Settings - Disable buffering for better error handling
    bufferCommands: false,           // Disable mongoose buffering
    
    // Additional Options
    maxStalenessSeconds: 90,         // How stale secondary can be before ignored
    retryWrites: true,               // Retry writes on transient errors
    retryReads: true,                // Retry reads on transient errors
    
    // Application Name for monitoring
    appName: 'ClinicPro-Backend'
  };
};

/**
 * Setup connection event listeners
 */
const setupConnectionEventListeners = (): void => {
  // Connection successful
  mongoose.connection.on('connected', () => {
    connectionState.isConnected = true;
    connectionState.isConnecting = false;
    connectionState.lastConnectionTime = new Date();
    connectionState.lastError = null;
    console.log(`✅ MongoDB Connected: ${mongoose.connection.host}`);
    console.log(`📊 Connection State: Ready (Pool: ${mongoose.connection.readyState})`);
  });

  // Connection error
  mongoose.connection.on('error', (err) => {
    connectionState.lastError = err;
    console.error('❌ MongoDB connection error:', err.message);
    
    // Log pool information if available
    if (mongoose.connection.db) {
      console.error('📊 Connection details:', {
        readyState: mongoose.connection.readyState,
        host: mongoose.connection.host,
        name: mongoose.connection.name
      });
    }
  });

  // Connection disconnected
  mongoose.connection.on('disconnected', () => {
    connectionState.isConnected = false;
    console.log('⚠️  MongoDB disconnected');
  });

  // Connection reconnected
  mongoose.connection.on('reconnected', () => {
    connectionState.isConnected = true;
    connectionState.lastError = null;
    console.log('🔄 MongoDB reconnected');
  });

  // Close event
  mongoose.connection.on('close', () => {
    connectionState.isConnected = false;
    connectionState.isConnecting = false;
    connectionState.connectionPromise = null;
    console.log('🔌 MongoDB connection closed');
  });
};

/**
 * Singleton MongoDB connection function
 * Ensures only one connection is created and reused across the application
 */
const connectDB = async (): Promise<typeof mongoose> => {
  // If already connected, return immediately
  if (connectionState.isConnected && mongoose.connection.readyState === 1) {
    console.log('♻️  Using existing MongoDB connection');
    return mongoose;
  }

  // If connection is in progress, wait for it
  if (connectionState.isConnecting && connectionState.connectionPromise) {
    console.log('⏳ Connection in progress, waiting...');
    return connectionState.connectionPromise;
  }

  // Check if we've exceeded maximum attempts
  if (connectionState.connectionAttempts >= MAX_CONNECTION_ATTEMPTS) {
    const error = new Error(`Failed to connect to MongoDB after ${MAX_CONNECTION_ATTEMPTS} attempts`);
    connectionState.lastError = error;
    throw error;
  }

  // Mark as connecting and increment attempts
  connectionState.isConnecting = true;
  connectionState.connectionAttempts++;

  console.log(`🔌 Attempting MongoDB connection (attempt ${connectionState.connectionAttempts}/${MAX_CONNECTION_ATTEMPTS})...`);

  // Create connection promise and cache it
  connectionState.connectionPromise = (async () => {
    try {
      const mongoURI = getMongoURI();
      const options = getConnectionOptions();

      // Setup event listeners before connecting
      setupConnectionEventListeners();

      // Disable mongoose buffering globally for better error handling
      mongoose.set('bufferCommands', false);

      // Connect to MongoDB
      const connection = await mongoose.connect(mongoURI, options);

      // Reset connection attempts on success
      connectionState.connectionAttempts = 0;
      
      console.log(`🎉 MongoDB connection established successfully!`);
      console.log(`📋 Database: ${connection.connection.name}`);
      console.log(`⚙️  Pool Settings: maxPoolSize=${options.maxPoolSize}, minPoolSize=${options.minPoolSize}`);

      return connection;
    } catch (error) {
      connectionState.isConnecting = false;
      connectionState.lastError = error as Error;
      connectionState.connectionPromise = null;

      console.error(`💥 MongoDB connection failed (attempt ${connectionState.connectionAttempts}):`, error);

      // If we haven't reached max attempts, schedule retry
      if (connectionState.connectionAttempts < MAX_CONNECTION_ATTEMPTS) {
        console.log(`🔄 Retrying connection in ${CONNECTION_RETRY_DELAY / 1000} seconds...`);
        await new Promise(resolve => setTimeout(resolve, CONNECTION_RETRY_DELAY));
        return connectDB(); // Recursive retry
      }

      throw error;
    }
  })();

  return connectionState.connectionPromise;
};

/**
 * Get current connection state for monitoring
 */
const getConnectionState = () => {
  return {
    ...connectionState,
    mongooseReadyState: mongoose.connection.readyState,
    mongooseReadyStateLabel: getReadyStateLabel(mongoose.connection.readyState),
    host: mongoose.connection.host,
    database: mongoose.connection.name,
    collections: Object.keys(mongoose.connection.collections).length
  };
};

/**
 * Convert mongoose ready state to human readable label
 */
const getReadyStateLabel = (state: number): string => {
  const states = {
    0: 'disconnected',
    1: 'connected',
    2: 'connecting',
    3: 'disconnecting'
  };
  return states[state as keyof typeof states] || 'unknown';
};

/**
 * Check if database connection is healthy
 */
const isConnectionHealthy = async (): Promise<boolean> => {
  try {
    if (!connectionState.isConnected || mongoose.connection.readyState !== 1) {
      return false;
    }

    // Perform a simple ping to verify connection
    if (mongoose.connection.db) {
      await mongoose.connection.db.admin().ping();
    } else {
      return false;
    }
    return true;
  } catch (error) {
    console.error('🏥 Database health check failed:', error);
    return false;
  }
};

/**
 * Graceful shutdown of database connection
 */
const gracefulShutdown = async (): Promise<void> => {
  try {
    if (mongoose.connection.readyState !== 0) {
      console.log('🔄 Closing MongoDB connection...');
      await mongoose.connection.close();
      console.log('✅ MongoDB connection closed gracefully');
    }
  } catch (error) {
    console.error('❌ Error during graceful shutdown:', error);
  } finally {
    // Reset connection state
    connectionState.isConnected = false;
    connectionState.isConnecting = false;
    connectionState.connectionPromise = null;
  }
};

// Setup graceful shutdown handlers
const setupGracefulShutdown = (): void => {
  const shutdownHandler = async (signal: string) => {
    console.log(`\n🛑 Received ${signal}, initiating graceful shutdown...`);
    await gracefulShutdown();
    process.exit(0);
  };

  process.on('SIGINT', () => shutdownHandler('SIGINT'));
  process.on('SIGTERM', () => shutdownHandler('SIGTERM'));
  process.on('SIGUSR2', () => shutdownHandler('SIGUSR2')); // nodemon restart
};

// Initialize graceful shutdown handlers
setupGracefulShutdown();

// Export functions
export default connectDB;
export { 
  getConnectionState, 
  isConnectionHealthy, 
  gracefulShutdown,
  connectionState 
}; 