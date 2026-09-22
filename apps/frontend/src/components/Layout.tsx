export function Layout({
    children
}: {
    readonly children: React.ReactNode;
}) {
    return (
        <div className="layout">
            <header className="site-header">
                <a
                    className="site-brand"
                    href="/"
                    aria-label="TickWeave home"
                >
                    <img
                        src="/tickweave-mark.svg"
                        alt=""
                        className="brand-mark"
                    />

                    <span className="brand-name">
                        TickWeave
                    </span>

                    <span className="brand-tag">
                        MARKET INTELLIGENCE
                    </span>
                </a>

                <nav
                    className="navigation"
                    aria-label="Primary navigation"
                >
                    <a className="nav-link" href="/">
                        Home
                    </a>

                    <a
                        className="nav-link nav-link-active"
                        href="/order-flow"
                    >
                        <span
                            className="nav-link-dot"
                            aria-hidden="true"
                        />
                        Order Flow Chart
                    </a>
                </nav>

                <div className="header-status">
                    <span
                        className="header-status-dot"
                        aria-hidden="true"
                    />
                    <span>Markets online</span>
                </div>
            </header>

            <main className="main">
                {children}
            </main>

            <footer className="footer">
                <p>
                    &copy; {new Date().getFullYear()}{" "}
                    TickWeave. All rights reserved.
                </p>
            </footer>
        </div>
    );
}

export default Layout;