##! Detect large outbound data transfers that may indicate exfiltration

module LargeTransfers;

export {
    redef enum Notice::Type += {
        Large_Outbound_Transfer
    };

    ## Threshold in bytes (10MB)
    const transfer_threshold: count = 10485760 &redef;
}

event connection_state_remove(c: connection)
{
    if ( ! Site::is_local_addr(c$id$orig_h) )
        return;

    if ( Site::is_local_addr(c$id$resp_h) )
        return;

    if ( c$orig$size > transfer_threshold )
    {
        NOTICE([
            $note=Large_Outbound_Transfer,
            $msg=fmt("Large outbound transfer: %s -> %s (%d bytes)",
                     c$id$orig_h, c$id$resp_h, c$orig$size),
            $src=c$id$orig_h,
            $dst=c$id$resp_h,
            $identifier=cat(c$id$orig_h, c$id$resp_h)
        ]);
    }
}
