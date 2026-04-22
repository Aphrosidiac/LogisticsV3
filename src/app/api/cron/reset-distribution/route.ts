import { NextResponse } from 'next/server';
import { withInternalAuth } from '@/lib/api-auth';
import { supabase, TABLES } from '@/lib/supabase';

export const POST = withInternalAuth(async () => {
    try {
        const { data: existing } = await supabase
            .from(TABLES.APP_CONFIG)
            .select('id')
            .limit(1)
            .single();

        if (existing) {
            const { error } = await supabase
                .from(TABLES.APP_CONFIG)
                .update({ last_auto_distribution_date: null })
                .eq('id', existing.id);
            if (error) throw error;
        }

        return NextResponse.json({ success: true });
    } catch (error: unknown) {
        return NextResponse.json({ success: false, error: (error as Error).message }, { status: 500 });
    }
});
