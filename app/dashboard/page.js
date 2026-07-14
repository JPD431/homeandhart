'use client';
import { useState, useEffect, Suspense } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import Navbar from '@/app/components/Navbar';
import OnboardingPendienteBanner from '@/app/components/OnboardingPendienteBanner';
import FamiliaInviteBanner from '@/app/components/FamiliaInviteBanner';
import ReportarIncidenciaForm from '@/app/components/ReportarIncidenciaForm';
import { useModo } from '@/app/lib/ModoContext';
import { getIngresoProveedorFromBooking } from '@/app/lib/ingresos-proveedor';
import { puedeReportarIncidencia } from '@/app/lib/booking-incidencia';
import { supabase } from '@/app/lib/supabase';

const BRAND = {
  blue: '#1d4f91',
  green: '#0e7a5c', 
  amber: '#c47d1a',
  warm: '#f7f5f2',
  border: '#e8e4de',
  dark: '#2a3a4a'
};

function getReservasSinComisionCliente(perfil) {
  return Number(perfil?.reservas_sin_comision_cliente) || 0;
}

function getReservasSinComisionProveedor(perfil) {
  return Number(perfil?.reservas_sin_comision_proveedor) || 0;
}

function DashboardContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const stripeParam = searchParams.get('stripe');
  const tabParam = searchParams.get('tab');
  const bookingHighlight = searchParams.get('booking');
  const { modo, setModo, puedeAlternarModo, isAdmin, onboardingIncompleto } = useModo();
  const [user, setUser] = useState(null);
  const [perfil, setPerfil] = useState(null);
  const [reservas, setReservas] = useState([]);
  const [favoritos, setFavoritos] = useState([]);
  const [viajes, setViajes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [clientSubTab, setClientSubTab] = useState('cliente');
  const [stripeBannerDismissed, setStripeBannerDismissed] = useState(false);

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.replace('/login'); return; }
      setUser(user);
      const { data: p } = await supabase.from('profiles').select('*').eq('id', user.id).single();
      setPerfil(p);
      if (p && !p.codigo_referido) {
        const codigo = 'HH-' + (p.nombre || 'USER').substring(0, 4).toUpperCase() + Math.floor(1000 + Math.random() * 9000);
        await supabase.from('profiles').update({ codigo_referido: codigo }).eq('id', user.id);
        p.codigo_referido = codigo;
      }
      const { data: r } = await supabase.from('bookings').select('*, services(titulo, vertical, proveedor_id, profiles_public!proveedor_id(nombre, apellido))').eq('cliente_id', user.id).order('created_at', { ascending: false }).limit(10);
      setReservas(r || []);
      const { data: f } = await supabase.from('favoritos').select('*, profiles_public!proveedor_id(id, nombre, apellido)').eq('cliente_id', user.id);
      setFavoritos(f || []);
      const { data: viajesData } = await supabase
        .from('viajes')
        .select(`
          id,
          nombre,
          fecha_inicio,
          fecha_fin,
          ciudad,
          viaje_reservas (
            bookings:booking_id (
              id,
              services:service_id (
                titulo,
                vertical
              )
            )
          )
        `)
        .eq('creador_id', user.id)
        .order('fecha_inicio', { ascending: false })
        .limit(3);
      setViajes(viajesData ?? []);
      setLoading(false);
    }
    load();
  }, [router]);

  useEffect(() => {
    if (isAdmin) {
      router.replace("/admin");
    }
  }, [isAdmin, router]);

  useEffect(() => {
    if (bookingHighlight) {
      setModo("proveedor", { redirect: false });
      return;
    }
    if (tabParam === "proveedor") {
      setModo("proveedor", { redirect: false });
      return;
    }
    if (
      tabParam === "cliente" ||
      tabParam === "familia" ||
      tabParam === "referidos" ||
      tabParam === "pasaporte"
    ) {
      setModo("cliente", { redirect: false });
      return;
    }
    // Sin tab ni booking en la URL: no tocar el modo (ModoContext/localStorage manda)
  }, [tabParam, bookingHighlight, setModo]);

  useEffect(() => {
    if (modo !== "proveedor" || !puedeAlternarModo) return;
    if (tabParam || bookingHighlight) return;
    router.replace("/dashboard?tab=proveedor", { scroll: false });
  }, [modo, puedeAlternarModo, tabParam, bookingHighlight, router]);

  useEffect(() => {
    if (modo !== "cliente") return;
    if (tabParam === "familia") setClientSubTab("familia");
    else if (tabParam === "referidos") setClientSubTab("referidos");
    else if (tabParam === "pasaporte") setClientSubTab("pasaporte");
    else if (tabParam === "cliente") setClientSubTab("cliente");
  }, [modo, tabParam]);

  useEffect(() => {
    if (stripeParam !== 'success' && stripeParam !== 'refresh') return;

    async function refetchPerfil() {
      const { data: { user: authUser } } = await supabase.auth.getUser();
      if (!authUser) return;
      const { data: p } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', authUser.id)
        .single();
      if (p) setPerfil(p);
    }

    refetchPerfil();
  }, [stripeParam]);

  function dismissStripeBanner() {
    setStripeBannerDismissed(true);
    const dest =
      modo === "proveedor" && puedeAlternarModo
        ? "/dashboard?tab=proveedor"
        : "/dashboard?tab=cliente";
    router.replace(dest);
  }

  const copiarLink = (codigo) => {
    const link = `${window.location.origin}/registro?ref=${codigo}`;
    if (navigator.clipboard && window.isSecureContext) {
      navigator.clipboard.writeText(link).then(() => alert('¡Link copiado!'));
    } else {
      const el = document.createElement('textarea');
      el.value = link;
      document.body.appendChild(el);
      el.select();
      document.execCommand('copy');
      document.body.removeChild(el);
      alert('¡Link copiado!');
    }
  };

  if (loading) return <div style={{background: BRAND.warm, minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center'}}><p style={{color: '#aaa'}}>Cargando...</p></div>;

  const nombreMostrar = perfil?.nombre || user?.email?.split('@')[0] || 'usuario';
  const enModoProveedor = modo === 'proveedor' && puedeAlternarModo;
  const clientTabs = ['cliente', 'familia', 'pasaporte', 'referidos'];

  return (
    <div style={{background: BRAND.warm, minHeight: '100vh'}}>
      <Navbar />

      {onboardingIncompleto && !isAdmin && <OnboardingPendienteBanner />}

      <div style={{ padding: '12px 16px 0', maxWidth: 960, margin: '0 auto' }}>
        <FamiliaInviteBanner compact />
      </div>

      {!stripeBannerDismissed && enModoProveedor && stripeParam === 'success' && (
        <div
          style={{
            background: '#e6f4f0',
            borderBottom: `1px solid ${BRAND.green}`,
            padding: '14px 16px',
            display: 'flex',
            alignItems: 'flex-start',
            justifyContent: 'space-between',
            gap: 12,
          }}
        >
          <p style={{ margin: 0, fontSize: 13, color: '#085041', lineHeight: 1.5 }}>
            <strong style={{ color: BRAND.green }}>¡Listo!</strong> Tus cobros están configurados.
            Ya puedes recibir pagos de tus reservas.
          </p>
          <button
            type="button"
            onClick={dismissStripeBanner}
            aria-label="Cerrar"
            style={{
              flexShrink: 0,
              background: 'none',
              border: 'none',
              color: BRAND.green,
              fontSize: 18,
              lineHeight: 1,
              cursor: 'pointer',
              padding: '0 4px',
            }}
          >
            ×
          </button>
        </div>
      )}

      {!stripeBannerDismissed && enModoProveedor && stripeParam === 'refresh' && (
        <div
          style={{
            background: '#fdf4e7',
            borderBottom: `1px solid ${BRAND.amber}`,
            padding: '14px 16px',
            display: 'flex',
            alignItems: 'flex-start',
            justifyContent: 'space-between',
            gap: 12,
          }}
        >
          <p style={{ margin: 0, fontSize: 13, color: '#5c4a32', lineHeight: 1.5 }}>
            Parece que no terminaste de configurar tus cobros. Puedes continuar cuando quieras
            desde el botón <strong>Configurar cobros</strong> en tu panel de proveedor.
          </p>
          <button
            type="button"
            onClick={dismissStripeBanner}
            aria-label="Cerrar"
            style={{
              flexShrink: 0,
              background: 'none',
              border: 'none',
              color: BRAND.amber,
              fontSize: 18,
              lineHeight: 1,
              cursor: 'pointer',
              padding: '0 4px',
            }}
          >
            ×
          </button>
        </div>
      )}
      
      {/* TABS — solo en modo cliente */}
      {!enModoProveedor && (
      <div
        className="flex overflow-x-auto [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden"
        style={{ background: '#fff', borderBottom: `0.5px solid ${BRAND.border}`, padding: '0 16px' }}
      >
        {clientTabs.map(t => (
          <button
            key={t}
            onClick={() => setClientSubTab(t)}
            className="shrink-0"
            style={{
              minHeight: 44,
              padding: '12px 20px',
              fontSize: 12,
              color: clientSubTab === t ? BRAND.blue : '#888',
              borderBottom: clientSubTab === t ? `2px solid ${BRAND.blue}` : '2px solid transparent',
              fontWeight: clientSubTab === t ? 500 : 400,
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              textTransform: 'capitalize',
              whiteSpace: 'nowrap',
            }}
          >
            {t.charAt(0).toUpperCase() + t.slice(1)}
          </button>
        ))}
      </div>
      )}

      {/* HEADER */}
      <div
        className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between"
        style={{ background: '#fff', borderBottom: `0.5px solid ${BRAND.border}`, padding: '20px 16px' }}
      >
        <div>
          <div style={{ fontSize: 'clamp(22px, 4vw, 26px)', fontWeight: 300, color: BRAND.dark, fontFamily: 'Georgia, serif' }}>Hola, <em style={{color: BRAND.blue}}>{nombreMostrar}.</em></div>
          <div style={{fontSize: 12, color: '#aaa', marginTop: 4}}>
            {enModoProveedor ? 'Panel de proveedor · Home&Heart' : 'Bienvenida a tu panel · Home&Heart'}
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <button onClick={() => router.push('/editar-perfil')} style={{ minHeight: 44, background: '#fff', color: BRAND.blue, border: `1px solid ${BRAND.blue}`, padding: '10px 18px', borderRadius: 4, fontSize: 12, cursor: 'pointer' }}>Editar perfil</button>
          {enModoProveedor ? (
            <>
              <button onClick={() => router.push('/estadisticas')} style={{ minHeight: 44, background: BRAND.blue, color: '#fff', border: 'none', padding: '10px 18px', borderRadius: 4, fontSize: 12, cursor: 'pointer', fontWeight: 500 }}>Ver estadísticas</button>
              <button onClick={() => router.push('/editar-perfil?tab=servicios')} style={{ minHeight: 44, background: '#fff', color: BRAND.blue, border: `1px solid ${BRAND.blue}`, padding: '10px 18px', borderRadius: 4, fontSize: 12, cursor: 'pointer' }}>Mis servicios</button>
            </>
          ) : (
            <button onClick={() => router.push('/buscar')} style={{ minHeight: 44, background: BRAND.blue, color: '#fff', border: 'none', padding: '10px 18px', borderRadius: 4, fontSize: 12, cursor: 'pointer', fontWeight: 500 }}>Buscar proveedores</button>
          )}
        </div>
      </div>

      {/* CONTENIDO POR MODO */}
      <div style={{padding: '20px 24px'}}>
        {enModoProveedor ? (
          <TabProveedor
            perfil={perfil}
            router={router}
            BRAND={BRAND}
            highlightBookingId={bookingHighlight}
          />
        ) : (
          <>
            {clientSubTab === 'cliente' && <TabCliente perfil={perfil} reservas={reservas} favoritos={favoritos} viajes={viajes} router={router} BRAND={BRAND} copiarLink={copiarLink} />}
            {clientSubTab === 'familia' && <TabFamilia perfil={perfil} router={router} BRAND={BRAND} />}
            {clientSubTab === 'pasaporte' && router.push('/pasaporte')}
            {clientSubTab === 'referidos' && <TabReferidos perfil={perfil} BRAND={BRAND} copiarLink={copiarLink} />}
          </>
        )}
      </div>
    </div>
  );
}

export default function DashboardPage() {
  return (
    <Suspense
      fallback={
        <div
          style={{
            background: BRAND.warm,
            minHeight: '100vh',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <p style={{ color: '#aaa' }}>Cargando...</p>
        </div>
      }
    >
      <DashboardContent />
    </Suspense>
  );
}

function TabCliente({ perfil, reservas, favoritos, viajes, router, BRAND, copiarLink }) {
  const creditoDisponible = Number(perfil?.credito_disponible) || 0;

  return (
    <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2 lg:grid-cols-3">
      {/* RESERVAS */}
      <div className="sm:col-span-2" style={{background: '#fff', borderRadius: 10, border: `0.5px solid ${BRAND.border}`, overflow: 'hidden'}}>
        <div style={{padding: '13px 16px', borderBottom: `0.5px solid #f0ede8`, display: 'flex', justifyContent: 'space-between', alignItems: 'center'}}>
          <span style={{fontSize: 11, fontWeight: 500, color: BRAND.dark}}>📅 Mis reservas</span>
          <span style={{fontSize: 9, padding: '2px 7px', borderRadius: 8, background: '#e8f0fb', color: '#163a6b'}}>{reservas.filter(r => ['confirmada','pendiente','en_curso'].includes(r.estado)).length} activas</span>
        </div>
        <div style={{padding: '13px 16px'}}>
          {reservas.length === 0 && (
            <div style={{ textAlign: 'center', padding: '20px 0' }}>
              <p style={{ fontSize: 13, color: '#888', margin: '0 0 12px' }}>
                Aún no tienes reservas como cliente.
              </p>
              <button
                type="button"
                onClick={() => router.push('/buscar')}
                style={{
                  minHeight: 44,
                  background: BRAND.blue,
                  color: '#fff',
                  border: 'none',
                  padding: '10px 18px',
                  borderRadius: 4,
                  fontSize: 12,
                  cursor: 'pointer',
                  fontWeight: 500,
                }}
              >
                Buscar un servicio
              </button>
            </div>
          )}
          {reservas.slice(0, 5).map(r => (
            <div key={r.id} style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: '0.5px solid #f5f3f0'}}>
              <div>
                <div style={{fontSize: 12, color: BRAND.dark, fontWeight: 500}}>{r.services?.titulo} · {r.services?.profiles_public?.nombre}</div>
                <div style={{fontSize: 10, color: '#aaa', marginTop: 1}}>{r.fecha_inicio}{r.fecha_fin ? ` – ${r.fecha_fin}` : ''} · {r.precio_total}€</div>
              </div>
              <span style={{fontSize: 9, padding: '2px 7px', borderRadius: 8, background: r.estado === 'confirmada' ? '#e8f0fb' : r.estado === 'completada' ? '#e6f4f0' : r.estado === 'en_curso' ? '#f0e8fb' : '#fef3c7', color: r.estado === 'confirmada' ? '#163a6b' : r.estado === 'completada' ? '#085041' : r.estado === 'en_curso' ? '#5b21b6' : '#92400e', whiteSpace: 'nowrap'}}>{r.estado}</span>
            </div>
          ))}
          <button onClick={() => router.push('/historial')} style={{ minHeight: 44, fontSize: 11, color: BRAND.blue, background: 'none', border: 'none', cursor: 'pointer', display: 'block', marginLeft: 'auto', marginTop: 8, padding: '8px 4px' }}>Ver historial completo →</button>
        </div>
      </div>

      {/* PERFIL */}
      <div style={{background: '#fff', borderRadius: 10, border: `0.5px solid ${BRAND.border}`, overflow: 'hidden'}}>
        <div style={{padding: '13px 16px', borderBottom: '0.5px solid #f0ede8'}}><span style={{fontSize: 11, fontWeight: 500, color: BRAND.dark}}>👤 Mi perfil</span></div>
        <div style={{padding: '13px 16px'}}>
          <div style={{display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10}}>
            <div style={{width: 40, height: 40, borderRadius: '50%', background: BRAND.blue, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, color: '#fff', fontWeight: 300}}>{(perfil?.nombre || 'U')[0]}</div>
            <div><div style={{fontSize: 13, fontWeight: 500, color: BRAND.dark}}>{perfil?.nombre} {perfil?.apellido}</div><div style={{fontSize: 10, color: '#aaa'}}>{perfil?.ciudad} · Cliente</div></div>
          </div>
          <div style={{display: 'flex', gap: 5, flexWrap: 'wrap', marginBottom: 10}}>
            {perfil?.codigo_referido && <span style={{fontSize: 8, padding: '2px 7px', borderRadius: 8, background: '#e8f0fb', color: '#163a6b'}}>{perfil.codigo_referido}</span>}
            {getReservasSinComisionCliente(perfil) > 0 && (
              <span style={{fontSize: 8, padding: '2px 7px', borderRadius: 8, background: '#e6f4f0', color: '#085041'}}>
                {getReservasSinComisionCliente(perfil)} sin comisión 🎁
              </span>
            )}
          </div>
          {creditoDisponible > 0 && (
            <p style={{ fontSize: 11, color: BRAND.green, fontWeight: 500, marginBottom: 10 }}>
              Crédito disponible: {creditoDisponible.toFixed(2)}€
            </p>
          )}
          <button onClick={() => router.push('/editar-perfil')} style={{ width: '100%', minHeight: 44, background: '#f7f5f2', color: BRAND.blue, border: `0.5px solid ${BRAND.blue}`, padding: '10px 8px', borderRadius: 5, fontSize: 10, cursor: 'pointer', fontWeight: 500 }}>Editar perfil</button>
        </div>
      </div>

      {/* FAVORITOS */}
      <div style={{background: '#fff', borderRadius: 10, border: `0.5px solid ${BRAND.border}`, overflow: 'hidden'}}>
        <div style={{padding: '13px 16px', borderBottom: '0.5px solid #f0ede8', display: 'flex', justifyContent: 'space-between', alignItems: 'center'}}>
          <span style={{fontSize: 11, fontWeight: 500, color: BRAND.dark}}>❤️ Favoritos</span>
          <span style={{fontSize: 9, padding: '2px 7px', borderRadius: 8, background: '#fdf3e3', color: '#92400e'}}>{favoritos.length}</span>
        </div>
        <div style={{padding: '13px 16px'}}>
          {favoritos.length === 0 && <p style={{fontSize: 12, color: '#bbb', textAlign: 'center', padding: '12px 0'}}>Guarda tus proveedores favoritos</p>}
          {favoritos.slice(0, 3).map(f => (
            <div key={f.id} style={{display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0', borderBottom: '0.5px solid #f5f3f0', cursor: 'pointer'}} onClick={() => router.push(`/proveedor/${f.proveedor_id}`)}>
              <div style={{width: 32, height: 32, borderRadius: '50%', background: BRAND.blue, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 500, color: '#fff', flexShrink: 0}}>{(f.profiles_public?.nombre || 'P')[0]}</div>
              <div style={{flex: 1}}><div style={{fontSize: 12, color: BRAND.dark, fontWeight: 500}}>{f.profiles_public?.nombre} {f.profiles_public?.apellido}</div></div>
              <span style={{fontSize: 14, color: BRAND.amber}}>♥</span>
            </div>
          ))}
        </div>
      </div>

      {/* PASAPORTE */}
      <div style={{background: '#fff', borderRadius: 10, border: `0.5px solid ${BRAND.border}`, overflow: 'hidden'}}>
        <div style={{padding: '13px 16px', borderBottom: '0.5px solid #f0ede8'}}><span style={{fontSize: 11, fontWeight: 500, color: BRAND.dark}}>🛂 Mi pasaporte</span></div>
        <div style={{padding: 0}}>
          <div onClick={() => router.push('/pasaporte')} style={{background: 'linear-gradient(135deg, #1d4f91 0%, #163a6b 100%)', padding: 16, cursor: 'pointer'}}>
            <div style={{fontSize: 10, color: 'rgba(255,255,255,.5)', letterSpacing: '.06em', textTransform: 'uppercase', marginBottom: 6}}>Home&Heart · Pasaporte</div>
            <div style={{fontSize: 16, fontWeight: 300, color: '#fff', fontFamily: 'Georgia, serif', marginBottom: 10}}>{perfil?.nombre} {perfil?.apellido}</div>
            <div style={{display: 'flex', gap: 16}}>
              <div><div style={{fontSize: 18, fontWeight: 200, color: '#fff'}}>—</div><div style={{fontSize: 9, color: 'rgba(255,255,255,.5)'}}>Ciudades</div></div>
              <div><div style={{fontSize: 18, fontWeight: 200, color: '#fff'}}>—</div><div style={{fontSize: 9, color: 'rgba(255,255,255,.5)'}}>Reservas</div></div>
            </div>
            <div style={{fontSize: 10, color: 'rgba(255,255,255,.4)', marginTop: 10}}>Ver pasaporte completo →</div>
          </div>
        </div>
      </div>

      {/* VIAJES */}
      <div style={{background: '#fff', borderRadius: 10, border: `0.5px solid ${BRAND.border}`, overflow: 'hidden'}}>
        <div style={{padding: '13px 16px', borderBottom: '0.5px solid #f0ede8', display: 'flex', justifyContent: 'space-between'}}>
          <span style={{fontSize: 11, fontWeight: 500, color: BRAND.dark}}>✈️ Mis viajes</span>
        </div>
        <div style={{padding: '13px 16px'}}>
          {viajes.length === 0 ? (
            <p style={{fontSize: 11, color: '#aaa'}}>Organiza todos tus servicios en un viaje</p>
          ) : (
            viajes.map(viaje => (
              <Link key={viaje.id} href={`/viaje/${viaje.id}`} style={{display:'block', padding:'8px 0', borderBottom:'0.5px solid #f5f3f0', textDecoration:'none'}}>
                <div style={{fontSize:12, fontWeight:500, color:'#2a3a4a'}}>📍 {viaje.ciudad || viaje.nombre}</div>
                <div style={{fontSize:10, color:'#aaa'}}>{viaje.fecha_inicio} — {viaje.fecha_fin} · {viaje.viaje_reservas?.length || 0} servicio(s)</div>
              </Link>
            ))
          )}
          <Link href="/viaje/nuevo" style={{fontSize:11, color:'#1d4f91', fontWeight:500, display:'block', marginTop:8}}>+ Nuevo viaje</Link>
        </div>
      </div>

      {/* REFERIDOS */}
      <div style={{background: '#fff', borderRadius: 10, border: `0.5px solid ${BRAND.border}`, overflow: 'hidden'}}>
        <div style={{padding: '13px 16px', borderBottom: '0.5px solid #f0ede8'}}><span style={{fontSize: 11, fontWeight: 500, color: BRAND.dark}}>🎁 Referidos</span></div>
        <div style={{padding: '13px 16px'}}>
          <div style={{background: '#f7f5f2', border: `0.5px solid ${BRAND.border}`, borderRadius: 6, padding: 10, display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8}}>
            <div><div style={{fontSize: 9, color: '#bbb', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 2}}>Tu código</div><div style={{fontSize: 13, fontWeight: 500, color: BRAND.blue}}>{perfil?.codigo_referido || '—'}</div></div>
            <button onClick={() => copiarLink(perfil?.codigo_referido)} style={{ minHeight: 44, fontSize: 10, color: BRAND.blue, border: `0.5px solid ${BRAND.blue}`, padding: '8px 12px', borderRadius: 4, background: '#fff', cursor: 'pointer', whiteSpace: 'nowrap' }}>Copiar link</button>
          </div>
          <p style={{fontSize: 10, color: '#888', lineHeight: 1.5}}>Por cada amigo que reserve recibirás 1 reserva extra sin comisión.</p>
          <div style={{marginTop: 8, fontSize: 11, color: '#666', display: 'flex', justifyContent: 'space-between', padding: '5px 0', borderBottom: '0.5px solid #f5f3f0'}}><span>Reservas sin comisión</span><span style={{fontWeight: 500, color: '#0e7a5c'}}>{getReservasSinComisionCliente(perfil)} 🎁</span></div>
        </div>
      </div>
    </div>
  );
}

function ProviderStatusBanner({ perfil, BRAND }) {
  if (perfil?.role !== "proveedor") return null;

  const verificado = perfil?.verificado === true;
  const cobrosActivos = perfil?.cobros_activos === true;

  let message;
  let borderColor;
  let background;
  let textColor;

  if (!verificado) {
    message =
      "Tus servicios están en revisión. Te avisaremos en menos de 24h.";
    borderColor = BRAND.amber;
    background = "#fdf4e7";
    textColor = "#5c4a32";
  } else if (!cobrosActivos) {
    message =
      "¡Aprobado! Configura tus cobros para activar tus servicios.";
    borderColor = BRAND.blue;
    background = "#e8f0fb";
    textColor = "#2a3a4a";
  } else {
    message = "Todo listo. Activa tus servicios cuando quieras.";
    borderColor = BRAND.green;
    background = "#e6f4f0";
    textColor = "#085041";
  }

  return (
    <div
      style={{
        marginTop: 16,
        padding: "14px 16px",
        borderRadius: 10,
        border: `1px solid ${borderColor}`,
        background,
      }}
    >
      <p style={{ fontSize: 13, fontWeight: 600, color: textColor, margin: 0 }}>
        {message}
      </p>
      {verificado && cobrosActivos && (
        <Link
          href="/editar-perfil?tab=servicios"
          style={{
            display: "inline-block",
            marginTop: 8,
            fontSize: 12,
            fontWeight: 600,
            color: BRAND.blue,
          }}
        >
          Ir a activar servicios →
        </Link>
      )}
    </div>
  );
}

function TabProveedor({ perfil, router, BRAND, highlightBookingId }) {
  const deudaPendiente = Number(perfil?.deuda_pendiente) || 0;
  const saldoPendienteTransferir =
    Math.round((Number(perfil?.saldo_pendiente_transferir) || 0) * 100) / 100;
  const tieneCuentaCobros = Boolean(perfil?.stripe_account_id);
  const [connectLoading, setConnectLoading] = useState(false);
  const [connectError, setConnectError] = useState('');

  async function handleConfigureCobros() {
    setConnectLoading(true);
    setConnectError('');
    try {
      const res = await fetch('/api/stripe/connect/create-account', { method: 'POST' });
      const data = await res.json();
      if (!res.ok || data.error) {
        setConnectError(data.error || 'No se pudo iniciar la configuración de cobros.');
        return;
      }
      if (data.url) {
        window.location.href = data.url;
        return;
      }
      setConnectError('No se recibió la URL de onboarding de Stripe.');
    } catch {
      setConnectError('Error de conexión. Inténtalo de nuevo.');
    } finally {
      setConnectLoading(false);
    }
  }

  return (
    <div style={{ maxWidth: 720, margin: '0 auto' }}>
      <ProviderStatusBanner perfil={perfil} BRAND={BRAND} />
      {deudaPendiente > 0 && (
        <div
          style={{
            marginTop: 16,
            padding: '14px 16px',
            borderRadius: 10,
            border: '1px solid #c47d1a',
            background: '#fdf4e7',
          }}
        >
          <p style={{ fontSize: 13, fontWeight: 600, color: '#2a3a4a', margin: 0 }}>
            Tienes una compensación pendiente
          </p>
          <p
            style={{
              fontSize: 12,
              color: '#5c4a32',
              marginTop: 8,
              marginBottom: 0,
              lineHeight: 1.5,
            }}
          >
            Por una o más cancelaciones, tienes una compensación pendiente de{' '}
            {deudaPendiente.toFixed(2)}€. Se descontará automáticamente de tus próximos cobros.
          </p>
        </div>
      )}
      {saldoPendienteTransferir > 0 && (
        <div
          style={{
            marginTop: 16,
            padding: '14px 16px',
            borderRadius: 10,
            border: `1px solid ${BRAND.green}`,
            background: '#e6f4f0',
          }}
        >
          <p style={{ fontSize: 13, fontWeight: 600, color: '#2a3a4a', margin: 0 }}>
            Cobro en camino
          </p>
          <p
            style={{
              fontSize: 12,
              color: '#085041',
              marginTop: 8,
              marginBottom: 0,
              lineHeight: 1.5,
            }}
          >
            Tienes {saldoPendienteTransferir.toFixed(2)}€ pendientes de envío a tu cuenta. Se
            enviarán automáticamente cuando el total alcance el mínimo de 0,50€.
          </p>
        </div>
      )}
      <div style={{ textAlign: 'center', padding: '24px 0 16px' }}>
        <div style={{ background: '#e6f4f0', borderRadius: 8, padding: '12px 16px', marginBottom: 16 }}>
          <div style={{ fontSize: 11, color: '#888', marginBottom: 4 }}>Reservas sin comisión</div>
          <div style={{ fontSize: 20, fontWeight: 600, color: '#0e7a5c' }}>{getReservasSinComisionProveedor(perfil)} 🎁</div>
          <div style={{ fontSize: 10, color: '#666', marginTop: 4 }}>Recibirás el 100% del pago en estas reservas</div>
        </div>

        {!tieneCuentaCobros ? (
          <div
            style={{
              marginBottom: 16,
              padding: '16px',
              borderRadius: 10,
              border: `1px solid ${BRAND.blue}`,
              background: '#e8f0fb',
              textAlign: 'left',
            }}
          >
            <p style={{ fontSize: 13, fontWeight: 600, color: '#2a3a4a', margin: 0 }}>
              Cobros
            </p>
            <p style={{ fontSize: 12, color: '#444', marginTop: 8, marginBottom: 12, lineHeight: 1.5 }}>
              Configura tus cobros para poder recibir pagos de tus reservas.
            </p>
            <button
              type="button"
              onClick={handleConfigureCobros}
              disabled={connectLoading}
              style={{
                minHeight: 44,
                background: BRAND.blue,
                color: '#fff',
                border: 'none',
                padding: '10px 20px',
                borderRadius: 4,
                fontSize: 12,
                fontWeight: 600,
                cursor: connectLoading ? 'not-allowed' : 'pointer',
                opacity: connectLoading ? 0.7 : 1,
              }}
            >
              {connectLoading ? 'Conectando…' : 'Configurar cobros'}
            </button>
          </div>
        ) : (
          <div
            style={{
              marginBottom: 16,
              padding: '12px 16px',
              borderRadius: 8,
              border: `0.5px solid ${BRAND.border}`,
              background: '#fff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 12,
              flexWrap: 'wrap',
            }}
          >
            <p style={{ fontSize: 12, color: '#666', margin: 0 }}>
              Cobros configurados
            </p>
            <button
              type="button"
              onClick={handleConfigureCobros}
              disabled={connectLoading}
              style={{
                minHeight: 36,
                background: '#fff',
                color: BRAND.blue,
                border: `1px solid ${BRAND.border}`,
                padding: '8px 14px',
                borderRadius: 4,
                fontSize: 11,
                fontWeight: 500,
                cursor: connectLoading ? 'not-allowed' : 'pointer',
                opacity: connectLoading ? 0.7 : 1,
              }}
            >
              {connectLoading ? 'Conectando…' : 'Gestionar cobros'}
            </button>
          </div>
        )}

        {connectError && (
          <p
            style={{
              marginBottom: 16,
              padding: '10px 12px',
              borderRadius: 6,
              background: '#fee2e2',
              color: '#b91c1c',
              fontSize: 12,
              lineHeight: 1.5,
              textAlign: 'left',
            }}
          >
            {connectError}
          </p>
        )}

        <p style={{ fontSize: 14, color: '#aaa', marginBottom: 16 }}>Panel de proveedor</p>
        <button onClick={() => router.push('/estadisticas')} style={{ minHeight: 44, background: BRAND.blue, color: '#fff', border: 'none', padding: '10px 20px', borderRadius: 4, fontSize: 12, cursor: 'pointer', marginRight: 8 }}>Ver estadísticas</button>
        <button onClick={() => router.push('/editar-perfil?tab=servicios')} style={{ minHeight: 44, background: '#fff', color: BRAND.blue, border: `1px solid ${BRAND.blue}`, padding: '10px 20px', borderRadius: 4, fontSize: 12, cursor: 'pointer' }}>Editar servicios</button>
      </div>
      <ReservasRecibidas
        perfil={perfil}
        BRAND={BRAND}
        highlightBookingId={highlightBookingId}
        router={router}
      />
    </div>
  );
}

const PRIMARY = '#1d4f91';
const GREEN = '#0e7a5c';
const AMBER = '#c47d1a';
const BORDER = '#e8e4de';

const ESTADO_BADGE = {
  pendiente: { bg: '#fdf3e3', color: AMBER, label: 'Pendiente' },
  confirmada: { bg: '#e6f4f0', color: GREEN, label: 'Confirmada' },
  rechazada: { bg: '#f3f4f6', color: '#6b7280', label: 'Rechazada' },
  completada: { bg: '#e8f0fb', color: PRIMARY, label: 'Completada' },
  cancelada: { bg: '#f3f4f6', color: '#6b7280', label: 'Cancelada' },
  cancelada_proveedor: { bg: '#f3f4f6', color: '#6b7280', label: 'Cancelada por ti' },
  cancelada_garantia: { bg: '#f3f4f6', color: '#6b7280', label: 'Cancelada' },
  en_curso: { bg: '#ede9fe', color: '#7c3aed', label: 'En curso' },
  incidencia: { bg: '#fee2e2', color: '#b91c1c', label: 'Incidencia' },
};

function formatReservaFechas(booking) {
  if (booking.hora) {
    const fecha = booking.fecha_inicio || '';
    return fecha ? `${fecha} · ${booking.hora}` : booking.hora;
  }
  if (booking.fecha_inicio && booking.fecha_fin && booking.fecha_fin !== booking.fecha_inicio) {
    return `${booking.fecha_inicio} – ${booking.fecha_fin}`;
  }
  return booking.fecha_inicio || '—';
}

function EstadoBadge({ estado }) {
  const meta = ESTADO_BADGE[estado] || { bg: '#f3f4f6', color: '#6b7280', label: estado || '—' };
  return (
    <span
      style={{
        fontSize: 10,
        fontWeight: 600,
        padding: '3px 8px',
        borderRadius: 8,
        background: meta.bg,
        color: meta.color,
        whiteSpace: 'nowrap',
      }}
    >
      {meta.label}
    </span>
  );
}

function formatImporteReservaRecibida(booking, sinComisionProveedor) {
  if (booking.pago_liberado_at != null) {
    if (booking.importe_transferido != null) {
      return {
        label: 'Cobrado:',
        amount: `${Number(booking.importe_transferido).toFixed(2)}€`,
      };
    }
    return { label: 'Cobrado:', amount: '—' };
  }
  return {
    label: 'Cobras (estimado):',
    amount: `${getIngresoProveedorFromBooking(booking, { sinComisionProveedor }).toFixed(2)}€`,
  };
}

function ReservaRecibidaCard({
  booking,
  serviceTitulo,
  clienteNombre,
  sinComisionProveedor,
  onRespond,
  responding,
  onCancelProvider,
  canceling,
  onIncidenciaReported,
  highlighted = false,
}) {
  const isPendiente = booking.estado === 'pendiente';
  const isConfirmada = booking.estado === 'confirmada';
  const isIncidencia = booking.estado === 'incidencia';
  const canReport = puedeReportarIncidencia(booking.estado);
  const importeReserva = formatImporteReservaRecibida(booking, sinComisionProveedor);

  return (
    <div
      id={`booking-${booking.id}`}
      style={{
        background: highlighted ? '#fffbeb' : '#fff',
        borderRadius: 10,
        border: highlighted
          ? `2px solid ${AMBER}`
          : `0.5px solid ${isPendiente ? AMBER : BORDER}`,
        padding: '14px 16px',
        marginBottom: 10,
        boxShadow: highlighted
          ? '0 0 0 3px rgba(196,125,26,0.15)'
          : isPendiente
            ? '0 1px 4px rgba(196,125,26,0.08)'
            : 'none',
        scrollMarginTop: 88,
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: '#2a3a4a' }}>{serviceTitulo}</div>
          <div style={{ fontSize: 11, color: '#888', marginTop: 4 }}>{clienteNombre}</div>
          <div style={{ fontSize: 11, color: '#666', marginTop: 4 }}>{formatReservaFechas(booking)}</div>
          <div style={{ fontSize: 13, fontWeight: 500, color: PRIMARY, marginTop: 6 }}>
            {importeReserva.label} {importeReserva.amount}
          </div>
          {booking.mensaje && (
            <p
              style={{
                fontSize: 11,
                color: '#666',
                marginTop: 8,
                padding: '8px 10px',
                background: '#f7f5f2',
                borderRadius: 6,
                lineHeight: 1.5,
                marginBottom: 0,
              }}
            >
              {booking.mensaje}
            </p>
          )}
        </div>
        <EstadoBadge estado={booking.estado} />
      </div>
      {isPendiente && (
        <div style={{ display: 'flex', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
          <button
            type="button"
            disabled={responding}
            onClick={() => onRespond(booking.id, 'aceptar')}
            style={{
              minHeight: 40,
              flex: 1,
              minWidth: 120,
              background: GREEN,
              color: '#fff',
              border: 'none',
              borderRadius: 6,
              fontSize: 12,
              fontWeight: 600,
              cursor: responding ? 'not-allowed' : 'pointer',
              opacity: responding ? 0.6 : 1,
            }}
          >
            {responding ? 'Procesando…' : 'Aceptar'}
          </button>
          <button
            type="button"
            disabled={responding}
            onClick={() => onRespond(booking.id, 'rechazar')}
            style={{
              minHeight: 40,
              flex: 1,
              minWidth: 120,
              background: '#fff',
              color: '#dc2626',
              border: '1px solid #dc2626',
              borderRadius: 6,
              fontSize: 12,
              fontWeight: 600,
              cursor: responding ? 'not-allowed' : 'pointer',
              opacity: responding ? 0.6 : 1,
            }}
          >
            {responding ? 'Procesando…' : 'Rechazar'}
          </button>
        </div>
      )}
      {isConfirmada && (
        <div style={{ display: 'flex', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
          <button
            type="button"
            disabled={canceling}
            onClick={() => onCancelProvider(booking.id)}
            style={{
              minHeight: 40,
              flex: 1,
              minWidth: 120,
              background: '#fff',
              color: '#dc2626',
              border: '1px solid #dc2626',
              borderRadius: 6,
              fontSize: 12,
              fontWeight: 600,
              cursor: canceling ? 'not-allowed' : 'pointer',
              opacity: canceling ? 0.6 : 1,
            }}
          >
            {canceling ? 'Cancelando…' : 'Cancelar reserva'}
          </button>
        </div>
      )}
      {isIncidencia && (
        <p
          style={{
            marginTop: 12,
            marginBottom: 0,
            fontSize: 11,
            color: '#b91c1c',
            background: '#fef2f2',
            border: '1px solid #fecaca',
            borderRadius: 6,
            padding: '8px 10px',
            lineHeight: 1.5,
          }}
        >
          Incidencia reportada. Nuestro equipo está revisando el caso.
        </p>
      )}
      {canReport && (
        <div style={{ marginTop: 12 }}>
          <ReportarIncidenciaForm
            bookingId={booking.id}
            compact
            onSuccess={() => onIncidenciaReported?.(booking.id)}
          />
        </div>
      )}
    </div>
  );
}

function ReservasRecibidas({ perfil, BRAND, highlightBookingId, router }) {
  const [bookings, setBookings] = useState([]);
  const [serviceMap, setServiceMap] = useState({});
  const [clientNames, setClientNames] = useState({});
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [actionError, setActionError] = useState('');
  const [stripeWarning, setStripeWarning] = useState('');
  const [respondingId, setRespondingId] = useState(null);
  const [cancelingId, setCancelingId] = useState(null);

  useEffect(() => {
    if (!perfil?.id) {
      return;
    }

    async function loadReservasRecibidas() {
      setLoading(true);
      setLoadError('');

      const { data: services, error: servicesError } = await supabase
        .from('services')
        .select('id, titulo')
        .eq('proveedor_id', perfil.id);

      if (servicesError) {
        setLoadError(servicesError.message);
        setLoading(false);
        return;
      }

      const servicesList = services ?? [];
      const map = Object.fromEntries(servicesList.map((s) => [s.id, s.titulo || 'Servicio']));
      setServiceMap(map);

      const serviceIds = servicesList.map((s) => s.id);

      if (serviceIds.length === 0) {
        setBookings([]);
        setClientNames({});
        setLoading(false);
        return;
      }

      const { data: bookingsData, error: bookingsError } = await supabase
        .from('bookings')
        .select('id, cliente_id, service_id, fecha_inicio, fecha_fin, hora, precio_total, precio_base, cliente_sin_comision, proveedor_sin_comision, estado, mensaje, created_at, pago_liberado_at, importe_transferido')
        .in('service_id', serviceIds)
        .order('created_at', { ascending: false });

      if (bookingsError) {
        setLoadError(bookingsError.message);
        setLoading(false);
        return;
      }

      const rows = bookingsData ?? [];
      setBookings(rows);

      const clienteIds = [...new Set(rows.map((b) => b.cliente_id).filter(Boolean))];
      if (clienteIds.length > 0) {
        const { data: profiles, error: profilesError } = await supabase
          .from('profiles_public')
          .select('id, nombre, apellido')
          .in('id', clienteIds);

        const names = {};
        for (const p of profiles ?? []) {
          const full = [p.nombre, p.apellido].filter(Boolean).join(' ').trim();
          names[p.id] = full || 'Cliente';
        }
        setClientNames(names);
      } else {
        setClientNames({});
      }

      setLoading(false);
    }

    loadReservasRecibidas();
  }, [perfil?.id]);

  useEffect(() => {
    if (!highlightBookingId || loading) return;

    const timer = setTimeout(() => {
      const el = document.getElementById(`booking-${highlightBookingId}`);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }, 150);

    return () => clearTimeout(timer);
  }, [highlightBookingId, loading, bookings]);

  async function handleRespond(bookingId, action) {
    const confirmMsg =
      action === 'aceptar'
        ? '¿Aceptar esta reserva?'
        : '¿Rechazar esta reserva? Se liberará el pago retenido del cliente.';
    if (!window.confirm(confirmMsg)) return;

    setRespondingId(bookingId);
    setActionError('');
    setStripeWarning('');

    try {
      const res = await fetch('/api/bookings/respond', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bookingId, action }),
      });
      const data = await res.json();

      if (!res.ok || !data.success) {
        setActionError(data.error || 'No se pudo procesar la reserva.');
        return;
      }

      setBookings((prev) =>
        prev.map((b) => (b.id === bookingId ? { ...b, estado: data.estado } : b)),
      );
    } catch (err) {
      setActionError(err.message || 'Error de conexión.');
    } finally {
      setRespondingId(null);
    }
  }

  function handleIncidenciaReported(bookingId) {
    setBookings((prev) =>
      prev.map((b) => (b.id === bookingId ? { ...b, estado: 'incidencia' } : b)),
    );
  }

  async function handleCancelProvider(bookingId) {
    if (
      !window.confirm(
        '¿Seguro que quieres cancelar esta reserva confirmada? El cliente recibirá el reembolso íntegro y esta cancelación puede afectar a tu cuenta.',
      )
    ) {
      return;
    }

    setCancelingId(bookingId);
    setActionError('');
    setStripeWarning('');

    try {
      const res = await fetch('/api/bookings/cancel-proveedor', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bookingId }),
      });
      const data = await res.json();

      if (!res.ok || !data.success) {
        setActionError(data.error || 'No se pudo cancelar la reserva.');
        return;
      }

      setBookings((prev) =>
        prev.map((b) =>
          b.id === bookingId ? { ...b, estado: 'cancelada_proveedor' } : b,
        ),
      );

      if (data.stripe_ok === false) {
        setStripeWarning(
          data.stripe_error
            ? `La cancelación se registró, pero hubo una incidencia con el reembolso: ${data.stripe_error}`
            : 'La cancelación se registró, pero hubo una incidencia al procesar el reembolso del cliente. Contacta con soporte si persiste.',
        );
      }
    } catch (err) {
      setActionError(err.message || 'Error de conexión.');
    } finally {
      setCancelingId(null);
    }
  }

  const pendientes = bookings.filter((b) => b.estado === 'pendiente');
  const resto = bookings.filter((b) => b.estado !== 'pendiente');
  const sinComisionProveedor = getReservasSinComisionProveedor(perfil) > 0;

  return (
    <div style={{ marginTop: 8, paddingBottom: 32 }}>
      <div
        style={{
          background: '#fff',
          borderRadius: 10,
          border: `0.5px solid ${BORDER}`,
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            padding: '13px 16px',
            borderBottom: `0.5px solid #f0ede8`,
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <span style={{ fontSize: 12, fontWeight: 600, color: BRAND.dark }}>
            📥 Reservas recibidas
          </span>
          {pendientes.length > 0 && (
            <span
              style={{
                fontSize: 10,
                fontWeight: 600,
                padding: '2px 8px',
                borderRadius: 8,
                background: '#fdf3e3',
                color: AMBER,
              }}
            >
              {pendientes.length} pendiente{pendientes.length !== 1 ? 's' : ''}
            </span>
          )}
        </div>

        <div style={{ padding: '13px 16px' }}>
          {loading && (
            <p style={{ fontSize: 12, color: '#aaa', textAlign: 'center', padding: '20px 0' }}>
              Cargando reservas…
            </p>
          )}

          {!loading && loadError && (
            <p
              style={{
                fontSize: 12,
                color: '#b91c1c',
                background: '#fee2e2',
                padding: '10px 12px',
                borderRadius: 6,
              }}
            >
              {loadError}
            </p>
          )}

          {!loading && !loadError && actionError && (
            <p
              style={{
                fontSize: 12,
                color: '#b91c1c',
                background: '#fee2e2',
                padding: '10px 12px',
                borderRadius: 6,
                marginBottom: 12,
              }}
            >
              {actionError}
            </p>
          )}

          {!loading && !loadError && stripeWarning && (
            <p
              style={{
                fontSize: 12,
                color: '#854d0e',
                background: '#fef3c7',
                padding: '10px 12px',
                borderRadius: 6,
                marginBottom: 12,
              }}
            >
              {stripeWarning}
            </p>
          )}

          {!loading && !loadError && bookings.length === 0 && (
            <p style={{ fontSize: 12, color: '#bbb', textAlign: 'center', padding: '24px 0' }}>
              Aún no has recibido reservas
            </p>
          )}

          {!loading && !loadError && pendientes.length > 0 && (
            <>
              <p
                style={{
                  fontSize: 10,
                  fontWeight: 600,
                  color: AMBER,
                  textTransform: 'uppercase',
                  letterSpacing: '0.06em',
                  marginBottom: 10,
                }}
              >
                Requieren tu respuesta
              </p>
              {pendientes.map((booking) => (
                <ReservaRecibidaCard
                  key={booking.id}
                  booking={booking}
                  serviceTitulo={serviceMap[booking.service_id] || 'Servicio'}
                  clienteNombre={clientNames[booking.cliente_id] || 'Cliente'}
                  sinComisionProveedor={sinComisionProveedor}
                  onRespond={handleRespond}
                  responding={respondingId === booking.id}
                  onCancelProvider={handleCancelProvider}
                  canceling={cancelingId === booking.id}
                  onIncidenciaReported={handleIncidenciaReported}
                  highlighted={booking.id === highlightBookingId}
                />
              ))}
            </>
          )}

          {!loading && !loadError && resto.length > 0 && (
            <>
              {pendientes.length > 0 && (
                <p
                  style={{
                    fontSize: 10,
                    fontWeight: 600,
                    color: '#888',
                    textTransform: 'uppercase',
                    letterSpacing: '0.06em',
                    margin: '20px 0 10px',
                  }}
                >
                  Historial
                </p>
              )}
              {resto.map((booking) => (
                <ReservaRecibidaCard
                  key={booking.id}
                  booking={booking}
                  serviceTitulo={serviceMap[booking.service_id] || 'Servicio'}
                  clienteNombre={clientNames[booking.cliente_id] || 'Cliente'}
                  sinComisionProveedor={sinComisionProveedor}
                  onRespond={handleRespond}
                  responding={respondingId === booking.id}
                  onCancelProvider={handleCancelProvider}
                  canceling={cancelingId === booking.id}
                  onIncidenciaReported={handleIncidenciaReported}
                  highlighted={booking.id === highlightBookingId}
                />
              ))}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function TabFamilia({ perfil, router, BRAND }) {
  return (
    <div style={{textAlign: 'center', padding: '40px 0'}}>
      <p style={{fontSize: 14, color: '#aaa', marginBottom: 16}}>Gestiona tu grupo familiar</p>
      <button onClick={() => router.push('/familia')} style={{ minHeight: 44, background: BRAND.blue, color: '#fff', border: 'none', padding: '10px 20px', borderRadius: 4, fontSize: 12, cursor: 'pointer' }}>Ir a mi familia</button>
    </div>
  );
}

function TabReferidos({ perfil, BRAND, copiarLink }) {
  return (
    <div style={{maxWidth: 480, margin: '0 auto', padding: '20px 0'}}>
      <div style={{background: '#fff', borderRadius: 10, border: `0.5px solid #e8e4de`, padding: 24}}>
        <h2 style={{fontSize: 16, fontWeight: 300, color: '#2a3a4a', fontFamily: 'Georgia, serif', marginBottom: 16}}>Tu programa de referidos</h2>
        <div style={{background: '#f7f5f2', border: '0.5px solid #e8e4de', borderRadius: 8, padding: 14, marginBottom: 14}}>
          <div style={{fontSize: 9, color: '#bbb', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 4}}>Tu código único</div>
          <div style={{fontSize: 20, fontWeight: 500, color: BRAND.blue, letterSpacing: '.04em'}}>{perfil?.codigo_referido || '—'}</div>
        </div>
        <p style={{fontSize: 12, color: '#888', lineHeight: 1.7, marginBottom: 16}}>Comparte tu código con amigos. Cada vez que alguien se registre con tu código y complete su primera reserva, recibirás 1 reserva extra sin comisión.</p>
        <div style={{background: '#e6f4f0', borderRadius: 6, padding: 12, marginBottom: 14}}>
          <div style={{fontSize: 11, color: '#085041', fontWeight: 500, marginBottom: 4}}>Tus reservas sin comisión</div>
          <div style={{fontSize: 28, fontWeight: 200, color: '#0e7a5c'}}>{getReservasSinComisionCliente(perfil)}</div>
        </div>
        <button onClick={() => copiarLink(perfil?.codigo_referido)} style={{ width: '100%', minHeight: 44, background: BRAND.blue, color: '#fff', border: 'none', padding: 12, borderRadius: 5, fontSize: 12, cursor: 'pointer', fontWeight: 500 }}>Copiar link de invitación</button>
      </div>
    </div>
  );
}
