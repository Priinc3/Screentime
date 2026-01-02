/**
 * Fetch all rows from a Supabase table with automatic pagination
 * Supabase has a default limit of 1000 rows per request
 */
export async function fetchAllRows<T>(
    query: any,
    batchSize: number = 1000
): Promise<T[]> {
    const allData: T[] = []
    let from = 0
    let hasMore = true

    while (hasMore) {
        const { data, error } = await query.range(from, from + batchSize - 1)

        if (error) {
            console.error('Pagination error:', error)
            break
        }

        if (!data || data.length === 0) {
            hasMore = false
        } else {
            allData.push(...data)
            from += batchSize

            // If we got less than batchSize, we've reached the end
            if (data.length < batchSize) {
                hasMore = false
            }
        }
    }

    return allData
}
