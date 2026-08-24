/** @type {import('next').NextConfig} */
const nextConfig = {
    output: "standalone",
    // Keep metadata in the initial document so the streamed hidden metadata
    // container cannot change the body tree during client hydration.
    htmlLimitedBots: /.*/,
    async redirects() {
        return [
            {
                source: '/pdf-templates',
                destination: '/dormitory/pdf-template',
                permanent: true,
            },
            {
                source: '/pdf-templates/new',
                destination: '/dormitory/pdf-template/new',
                permanent: true,
            },
            {
                source: '/pdf-templates/:templateTypeCode/edit',
                destination: '/dormitory/pdf-template/:templateTypeCode/edit',
                permanent: true,
            },
        ];
    },
    async headers() {
        return [
            {
                source: '/sw.js',
                headers: [
                    {
                        key: 'Content-Type',
                        value: 'application/javascript; charset=utf-8',
                    },
                    {
                        key: 'Cache-Control',
                        value: 'no-cache, no-store, must-revalidate',
                    },
                    {
                        key: 'Service-Worker-Allowed',
                        value: '/',
                    },
                ],
            },
        ];
    },
};

module.exports = nextConfig;
