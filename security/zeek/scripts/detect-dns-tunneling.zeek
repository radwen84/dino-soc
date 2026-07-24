
##! Detect DNS tunneling by monitoring query lengths and entropy

module DNSTunneling;

export {
    redef enum Notice::Type += {
        DNS_Tunneling_Detected
    };

    ## Minimum query length to consider suspicious
    const min_query_length = 50 &redef;

    ## Number of long queries before alerting
    const query_threshold = 20 &redef;

    ## Time window for counting
    const time_window = 5min &redef;
}

global dns_query_counts: table[addr] of count &create_expire=time_window &default=0;

event dns_request(c: connection, msg: dns_msg, query: string, qtype: count, qclass: count)
{
    if ( |query| >= min_query_length )
    {
        local src = c$id$orig_h;
        ++dns_query_counts[src];

        if ( dns_query_counts[src] >= query_threshold )
        {
            NOTICE([
                $note=DNS_Tunneling_Detected,
                $msg=fmt("Possible DNS tunneling from %s: %d long queries in %s",
                         src, dns_query_counts[src], time_window),
                $src=src,
                $identifier=cat(src)
            ]);
            dns_query_counts[src] = 0;
        }
    }
}
