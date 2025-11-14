'use server';

import { createClient } from '@supabase/supabase-js';
import { scrapeUrl } from '@/lib/scraper';

export async function createTrackedItem(
  url: string,
  targetPrice?: number,
  userId?: string
) {
  try {
    // Create Supabase client with service role key (bypasses RLS for server operations)
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    if (!userId) {
      return { success: false, error: 'Not authenticated' };
    }

    // Scrape the URL
    const scrapedData = await scrapeUrl(url);

    if (scrapedData.error) {
      return {
        success: false,
        error: scrapedData.error,
        warning: true,
      };
    }

    // Extract retailer name from domain
    const domain = new URL(url).hostname.replace('www.', '');
    const { data: retailerData } = await supabase
      .from('retailers')
      .select('name')
      .eq('domain', domain)
      .single();

    const retailerName = retailerData?.name || domain;

    // Insert item into database
    const { data: item, error: insertError } = await supabase
      .from('tracked_items')
      .insert({
        user_id: userId,
        url,
        name: scrapedData.title || 'Untitled Item',
        current_price: scrapedData.price,
        target_price: targetPrice,
        retailer_name: retailerName,
        thumbnail_url: scrapedData.imageUrl,
        last_price_checked_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (insertError) {
      console.error('[v0] Insert error:', insertError);
      return { success: false, error: 'Failed to save item' };
    }

    // Insert initial price history record
    const { error: priceHistoryError } = await supabase
      .from('price_history')
      .insert({
        item_id: item.id,
        price: scrapedData.price,
      });

    if (priceHistoryError) {
      console.error('[v0] Price history insert error:', priceHistoryError);
      return { success: false, error: 'Failed to save price history' };
    }

    return {
      success: true,
      item,
      data: scrapedData,
    };
  } catch (error) {
    console.error('[v0] Error creating tracked item:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred',
    };
  }
}
