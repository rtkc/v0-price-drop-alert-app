-- Create users table
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT UNIQUE NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Create tracked items table
CREATE TABLE IF NOT EXISTS tracked_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  url TEXT NOT NULL,
  current_price DECIMAL(10, 2),
  target_price DECIMAL(10, 2),
  price_drop_threshold DECIMAL(3, 1) DEFAULT 5,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Create price history table
CREATE TABLE IF NOT EXISTS price_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id UUID NOT NULL REFERENCES tracked_items(id) ON DELETE CASCADE,
  price DECIMAL(10, 2) NOT NULL,
  checked_at TIMESTAMP DEFAULT NOW()
);

-- Create price alerts table
CREATE TABLE IF NOT EXISTS price_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id UUID NOT NULL REFERENCES tracked_items(id) ON DELETE CASCADE,
  old_price DECIMAL(10, 2) NOT NULL,
  new_price DECIMAL(10, 2) NOT NULL,
  price_drop_percent DECIMAL(5, 2),
  created_at TIMESTAMP DEFAULT NOW(),
  notified BOOLEAN DEFAULT FALSE
);

-- Enable Row Level Security
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE tracked_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE price_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE price_alerts ENABLE ROW LEVEL SECURITY;

-- Create policies for users table
CREATE POLICY "Users can view their own data" ON users
  FOR SELECT USING (auth.uid()::text = id::text);

-- Create policies for tracked_items table
CREATE POLICY "Users can view their own items" ON tracked_items
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Users can insert their own items" ON tracked_items
  FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update their own items" ON tracked_items
  FOR UPDATE USING (user_id = auth.uid());

CREATE POLICY "Users can delete their own items" ON tracked_items
  FOR DELETE USING (user_id = auth.uid());

-- Create policies for price_history table
CREATE POLICY "Users can view price history of their items" ON price_history
  FOR SELECT USING (
    item_id IN (SELECT id FROM tracked_items WHERE user_id = auth.uid())
  );

-- Create policies for price_alerts table
CREATE POLICY "Users can view alerts for their items" ON price_alerts
  FOR SELECT USING (
    item_id IN (SELECT id FROM tracked_items WHERE user_id = auth.uid())
  );

-- Create indexes
CREATE INDEX idx_tracked_items_user_id ON tracked_items(user_id);
CREATE INDEX idx_price_history_item_id ON price_history(item_id);
CREATE INDEX idx_price_alerts_item_id ON price_alerts(item_id);
