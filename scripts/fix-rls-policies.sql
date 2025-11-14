-- Add missing INSERT policy for price_history table
CREATE POLICY "Users can insert price history for their items" ON price_history
  FOR INSERT WITH CHECK (
    item_id IN (SELECT id FROM tracked_items WHERE user_id = auth.uid())
  );

-- Add missing INSERT policy for price_alerts table
CREATE POLICY "Users can insert alerts for their items" ON price_alerts
  FOR INSERT WITH CHECK (
    item_id IN (SELECT id FROM tracked_items WHERE user_id = auth.uid())
  );
