import { Activity, BookOpenText, ChartNoAxesCombined, Moon, Sun } from "lucide-react";
import { NavLink } from "react-router-dom";
import { Badge } from "./ui/badge";
import { Button } from "./ui/button";
import { ThemeProvider, useTheme } from "./ThemeProvider";
import { NavigationMenu, NavigationMenuItem, NavigationMenuLink, NavigationMenuList } from "./ui/navigation-menu";

function ThemeToggle() {
    const { theme, setTheme } = useTheme();
    const nextTheme = theme === "dark" ? "light" : "dark";

    return (
        <Button
            aria-label={`Switch to ${nextTheme} mode`}
            title={`Switch to ${nextTheme} mode`}
            variant="outline"
            size="icon"
            onClick={() => setTheme(nextTheme)}
        >
            {theme === "dark" ? <Sun size={15} /> : <Moon size={15} />}
        </Button>
    );
}

export function Layout({
    children
}: {
    readonly children: React.ReactNode;
}) {
    return (
        <ThemeProvider>
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
                        ORDER FLOW INTELLIGENCE
                    </span>
                </a>

                <NavigationMenu className="navigation" viewport={false}>
                    <NavigationMenuList>
                        <NavigationMenuItem>
                            <NavigationMenuLink asChild>
                                <NavLink to="/" end className={({ isActive }) => isActive ? "nav-link nav-link-active" : "nav-link"}>
                                    <Activity size={14} aria-hidden="true" />
                                    Home
                                </NavLink>
                            </NavigationMenuLink>
                        </NavigationMenuItem>
                        <NavigationMenuItem>
                            <NavigationMenuLink asChild>
                                <NavLink to="/order-flow" className={({ isActive }) => isActive ? "nav-link nav-link-active" : "nav-link"}>
                                    <ChartNoAxesCombined size={14} aria-hidden="true" />
                                    Order Flow Chart
                                </NavLink>
                            </NavigationMenuLink>
                        </NavigationMenuItem>
                        <NavigationMenuItem>
                            <NavigationMenuLink asChild>
                                <NavLink to="/education" className={({ isActive }) => isActive ? "nav-link nav-link-active" : "nav-link"}>
                                    <BookOpenText size={14} aria-hidden="true" />
                                    Order Flow Guide
                                </NavLink>
                            </NavigationMenuLink>
                        </NavigationMenuItem>
                    </NavigationMenuList>
                </NavigationMenu>

                <ThemeToggle />

                <Badge variant="outline" className="header-status">
                    <span className="header-status-dot" aria-hidden="true" />
                    Markets online
                </Badge>
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
                </ThemeProvider>
    );
}

export default Layout;