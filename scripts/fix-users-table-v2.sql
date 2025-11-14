-- Drop existing tables and recreate with correct schema
-- The issue: users.id was generating random UUIDs instead of using auth.uid()
-- Solution: Make users.id reference auth.users(id) directly

-- Drop dependent tables first (due to foreign key constraints)
DROP TABLE IF EXISTS price_alerts CASCADE;
DROP TABLE IF EXISTS price_history CASCADE;
DROP TABLE IF EXISTS tracked_items CASCADE;
DROP TABLE IF EXISTS users CASCADE;

-- Recreate users table with correct primary key
CREATE TABLE users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT UNIQUE NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Recreate tracked items table
CREATE TABLE tracked_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  url TEXT NOT NULL,
  current_price DECIMAL(10, 2),
  target_price DECIMAL(10, 2),
  price_drop_threshold DECIMAL(3, 1) DEFAULT 5,
  last_checked_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Recreate price history table
CREATE TABLE price_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id UUID NOT NULL REFERENCES tracked_items(id) ON DELETE CASCADE,
  price DECIMAL(10, 2) NOT NULL,
  checked_at TIMESTAMP DEFAULT NOW()
);

-- Recreate price alerts table
CREATE TABLE price_alerts (
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
  FOR SELECT USING (auth.uid() = id);

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

-- Create the trigger to auto-create users on signup
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO users (id, email)
  VALUES (new.id, new.email)
  ON CONFLICT (id) DO NOTHING;
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION handle_new_user();
