export function getHostname(url: string): string | undefined {
    let parts = url.split("/");

    if (parts.length < 3) {
        // We're on a special page, like a tab page, or a settings page
        return undefined;
    } else {
        // [2] should be the bit after the protocol
        // Now we just check if we have a proper website (i.e. domain.tld)

        let domain = parts[2];

        if (domain.split(".").length < 2) {
            return undefined;
        } else {
            return domain;
        }
    }
}
