import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { 
  Building2, 
  LogOut, 
  User, 
  Menu,
  Home,
  FileSearch,
  Handshake,
  ClipboardList,
  Upload
} from 'lucide-react';
import { useState } from 'react';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';

export function Header() {
  const { user, profile, signOut } = useAuth();
  const navigate = useNavigate();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const handleSignOut = async () => {
    await signOut();
    navigate('/');
  };

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  const navLinks = user ? [
    { href: '/dashboard', label: 'Dashboard', icon: Home },
    { href: '/properties', label: 'Imóveis', icon: Building2 },
    { href: '/demands', label: 'Demandas', icon: FileSearch },
    { href: '/agreements', label: 'Acordos', icon: Handshake },
  ] : [];

  return (
    <header className="sticky top-0 z-50 w-full glass border-b">
      <div className="container flex h-16 items-center justify-between">
        <div className="flex items-center gap-6">
          <Link to={user ? '/dashboard' : '/'} className="flex items-center gap-2">
            <div className="h-9 w-9 rounded-lg gradient-bg flex items-center justify-center">
              <Handshake className="h-5 w-5 text-primary-foreground" />
            </div>
            <span className="font-display font-bold text-xl hidden sm:block">
              <span className="gradient-text">Corretor</span>
              <span className="text-foreground">Camarada</span>
            </span>
          </Link>

          {user && (
            <nav className="hidden md:flex items-center gap-1">
              {navLinks.map((link) => (
                <Link key={link.href} to={link.href}>
                  <Button variant="ghost" size="sm" className="gap-2">
                    <link.icon className="h-4 w-4" />
                    {link.label}
                  </Button>
                </Link>
              ))}
            </nav>
          )}
        </div>

        <div className="flex items-center gap-4">
          {user ? (
            <>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" className="relative h-10 w-10 rounded-full">
                    <Avatar className="h-10 w-10">
                      <AvatarImage src={profile?.avatar_url || undefined} />
                      <AvatarFallback className="gradient-bg text-primary-foreground">
                        {profile?.full_name ? getInitials(profile.full_name) : 'U'}
                      </AvatarFallback>
                    </Avatar>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent className="w-56" align="end">
                  <DropdownMenuLabel className="font-normal">
                    <div className="flex flex-col space-y-1">
                      <p className="text-sm font-medium">{profile?.full_name || 'Usuário'}</p>
                      <p className="text-xs text-muted-foreground">{user.email}</p>
                      {profile?.creci && (
                        <p className="text-xs text-muted-foreground">CRECI: {profile.creci}</p>
                      )}
                    </div>
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => navigate('/profile')}>
                    <User className="mr-2 h-4 w-4" />
                    Meu Perfil
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => navigate('/logs')}>
                    <ClipboardList className="mr-2 h-4 w-4" />
                    Histórico
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={handleSignOut} className="text-destructive">
                    <LogOut className="mr-2 h-4 w-4" />
                    Sair
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>

              {/* Mobile Menu */}
              <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
                <SheetTrigger asChild className="md:hidden">
                  <Button variant="ghost" size="icon">
                    <Menu className="h-5 w-5" />
                  </Button>
                </SheetTrigger>
                <SheetContent side="right" className="w-64">
                  <nav className="flex flex-col gap-2 mt-8">
                    {navLinks.map((link) => (
                      <Link 
                        key={link.href} 
                        to={link.href}
                        onClick={() => setMobileMenuOpen(false)}
                      >
                        <Button variant="ghost" className="w-full justify-start gap-2">
                          <link.icon className="h-4 w-4" />
                          {link.label}
                        </Button>
                      </Link>
                    ))}
                  </nav>
                </SheetContent>
              </Sheet>
            </>
          ) : (
            <div className="flex items-center gap-2">
              <Link to="/auth">
                <Button variant="ghost">Entrar</Button>
              </Link>
              <Link to="/auth?mode=signup">
                <Button className="gradient-bg">Cadastrar</Button>
              </Link>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}