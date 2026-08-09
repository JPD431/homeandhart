'use client';
import { useState, useEffect, Suspense, useCallback } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import Navbar from '@/app/components/Navbar';
import OnboardingPendienteBanner from '@/app/components/OnboardingPendienteBanner';
import FamiliaInviteBanner from '@/app/components/FamiliaInviteBanner';
import AyudaLink from '@/app/components/AyudaLink';
import ReportarIncidenciaForm from '@/app/components/ReportarIncidenciaForm';
import BookingStatusBadge from '@/app/components/BookingStatusBadge';
import { ActionToastHost, useActionToast } from '@/app/components/ActionToast';
import EmptyState from '@/app/components/EmptyState';
import ProviderFirstStepsChecklist from '@/app/components/ProviderFirstStepsChecklist';
import ProviderListingChecklist, {
  useWeakAlojamientoListings,
} from '@/app/components/ProviderListingChecklist';
import ListingWeakBanner from '@/app/components/ListingWeakBanner';
import ClienteVerificadoBadge from '@/app/components/ClienteVerificadoBadge';
import DataLoadFailed from '@/app/components/DataLoadFailed';
import ProveedorPreguntarButton from '@/app/components/ProveedorPreguntarButton';
import { useModo } from '@/app/lib/ModoContext';
import { getIngresoProveedorFromBooking } from '@/app/lib/ingresos-proveedor';
import { puedeReportarIncidencia } from '@/app/lib/booking-incidencia';
import { PROVIDER_CONTACT_BANNER_MSG } from '@/app/lib/profile-telefono';
import { providerMissingContactBanner } from '@/app/lib/provider-publicacion';
import {
  canShowProviderContact,
  getBookingStatusMeta,
} from '@/app/lib/booking-display';
import { supabase } from '@/app/lib/supabase';
import { friendlyLoadError, withLoadTimeout } from '@/app/lib/with-load-timeout';
import { useLang } from '@/app/lib/LangContext';
import { useTranslation } from '@/app/lib/i18n';

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
  const { lang } = useLang();
  const t = useTranslation(lang);
  const [user, setUser] = useState(null);
  const [perfil, setPerfil] = useState(null);
  const [reservas, setReservas] = useState([]);
  const [favoritos, setFavoritos] = useState([]);
  const [viajes, setViajes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [reloadKey, setReloadKey] = useState(0);
  const [clientSubTab, setClientSubTab] = useState('cliente');
  const [stripeBannerDismissed, setStripeBannerDismissed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    let navigatedAway = false;

    async function load() {
      setLoading(true);
      setLoadError('');
      try {
        await withLoadTimeout((async () => {
          const { data: { user } } = await supabase.auth.getUser();
          if (!user) {
            navigatedAway = true;
            router.replace('/login');
            return;
          }
          if (cancelled) return;
          setUser(user);
          const { data: p, error: profileError } = await supabase.from('profiles').select('*').eq('id', user.id).single();
          if (profileError) throw profileError;
          if (cancelled) return;
          setPerfil(p);
          if (p && !p.codigo_referido) {
            const codigo = 'HH-' + (p.nombre || 'USER').substring(0, 4).toUpperCase() + Math.floor(1000 + Math.random() * 9000);
            await supabase.from('profiles').update({ codigo_referido: codigo }).eq('id', user.id);
            p.codigo_referido = codigo;
          }
          const { data: r, error: bookingsError } = await supabase.from('bookings').select('*, services(titulo, vertical, proveedor_id, profiles_public!proveedor_id(nombre, apellido))').eq('cliente_id', user.id).order('created_at', { ascending: false }).limit(10);
          if (bookingsError) throw bookingsError;
          if (cancelled) return;
          setReservas(r || []);
          const { data: f, error: favError } = await supabase.from('favoritos').select('*, profiles_public!proveedor_id(id, nombre, apellido)').eq('cliente_id', user.id);
          if (favError) throw favError;
          if (cancelled) return;
          setFavoritos(f || []);
          const { data: viajesData, error: viajesError } = await supabase
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
          if (viajesError) throw viajesError;
          if (cancelled) return;
          setViajes(viajesData ?? []);
        })());
      } catch (err) {
        if (!cancelled && !navigatedAway) {
          setLoadError(friendlyLoadError(err));
        }
      } finally {
        if (!cancelled && !navigatedAway) setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [router, reloadKey]);

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
      navigator.clipboard.writeText(link).then(() => alert(t.dashboard.linkCopiado));
    } else {
      const el = document.createElement('textarea');
      el.value = link;
      document.body.appendChild(el);
      el.select();
      document.execCommand('copy');
      document.body.removeChild(el);
      alert(t.dashboard.linkCopiado);
    }
  };

  if (loading) return <div style={{background: BRAND.warm, minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center'}}><p style={{color: '#aaa'}}>{t.dashboard.cargando}</p></div>;

  if (loadError) {
    return (
      <div style={{ background: BRAND.warm, minHeight: '100vh' }}>
        <Navbar />
        <DataLoadFailed
          message={loadError}
          onRetry={() => setReloadKey((k) => k + 1)}
        />
      </div>
    );
  }

  const nombreMostrar = perfil?.nombre || user?.email?.split('@')[0] || 'usuario';
  const enModoProveedor = modo === 'proveedor' && puedeAlternarModo;
  const clientTabs = ['cliente', 'familia', 'pasaporte', 'referidos'];
  const tabLabels = {
    cliente: t.dashboard.tabCliente,
    familia: t.dashboard.tabFamilia,
    pasaporte: t.dashboard.tabPasaporte,
    referidos: t.dashboard.tabReferidos,
  };

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
            {perfil?.cobros_activos === true ? (
              <>
                <strong style={{ color: BRAND.green }}>{t.dashboard.stripeBannerAnuncioActivo}</strong>{' '}
                {t.dashboard.stripeBannerYaPuedesRecibir}
              </>
            ) : (
              <>
                <strong style={{ color: BRAND.green }}>{t.dashboard.stripeBannerListo}</strong>{' '}
                {t.dashboard.stripeBannerActivandoCobros}
              </>
            )}
          </p>
          <button
            type="button"
            onClick={dismissStripeBanner}
            aria-label={t.dashboard.cerrar}
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
            {t.dashboard.stripeBannerRefreshPre}{' '}
            <strong>{t.dashboard.stripeBannerRefreshBtn}</strong>{' '}
            {t.dashboard.stripeBannerRefreshPost}
          </p>
          <button
            type="button"
            onClick={dismissStripeBanner}
            aria-label={t.dashboard.cerrar}
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

      {enModoProveedor &&
        providerMissingContactBanner(perfil, user?.email) && (
        <div
          style={{
            background: '#e8f0fb',
            borderBottom: `1px solid ${BRAND.border}`,
            padding: '14px 16px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 12,
            flexWrap: 'wrap',
          }}
        >
          <p style={{ margin: 0, fontSize: 13, color: BRAND.blue, lineHeight: 1.5 }}>
            {PROVIDER_CONTACT_BANNER_MSG}
          </p>
          <Link
            href="/editar-perfil?tab=perfil"
            style={{
              fontSize: 12,
              fontWeight: 600,
              color: BRAND.blue,
              textDecoration: 'underline',
              whiteSpace: 'nowrap',
            }}
          >
            {t.dashboard.completarDatos}
          </Link>
        </div>
      )}

      {/* TABS — solo en modo cliente */}
      {!enModoProveedor && (
      <div
        className="flex overflow-x-auto [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden"
        style={{ background: '#fff', borderBottom: `0.5px solid ${BRAND.border}`, padding: '0 16px' }}
      >
        {clientTabs.map(tab => (
          <button
            key={tab}
            onClick={() => setClientSubTab(tab)}
            className="shrink-0"
            style={{
              minHeight: 44,
              padding: '12px 20px',
              fontSize: 12,
              color: clientSubTab === tab ? BRAND.blue : '#888',
              borderBottom: clientSubTab === tab ? `2px solid ${BRAND.blue}` : '2px solid transparent',
              fontWeight: clientSubTab === tab ? 500 : 400,
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              textTransform: 'capitalize',
              whiteSpace: 'nowrap',
            }}
          >
            {tabLabels[tab]}
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
          <div style={{ fontSize: 'clamp(22px, 4vw, 26px)', fontWeight: 300, color: BRAND.dark, fontFamily: 'Georgia, serif' }}>{t.dashboard.hola} <em style={{color: BRAND.blue}}>{nombreMostrar}.</em></div>
          <div style={{fontSize: 12, color: '#aaa', marginTop: 4}}>
            {enModoProveedor ? t.dashboard.subtituloProveedor : t.dashboard.subtituloCliente}
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <button onClick={() => router.push('/editar-perfil')} style={{ minHeight: 44, background: '#fff', color: BRAND.blue, border: `1px solid ${BRAND.blue}`, padding: '10px 18px', borderRadius: 4, fontSize: 12, cursor: 'pointer' }}>{t.dashboard.editarPerfil}</button>
          {enModoProveedor ? (
            <>
              <button onClick={() => router.push('/estadisticas')} style={{ minHeight: 44, background: BRAND.blue, color: '#fff', border: 'none', padding: '10px 18px', borderRadius: 4, fontSize: 12, cursor: 'pointer', fontWeight: 500 }}>{t.dashboard.verEstadisticas}</button>
              <button onClick={() => router.push('/editar-perfil?tab=servicios')} style={{ minHeight: 44, background: '#fff', color: BRAND.blue, border: `1px solid ${BRAND.blue}`, padding: '10px 18px', borderRadius: 4, fontSize: 12, cursor: 'pointer' }}>{t.dashboard.misServicios}</button>
            </>
          ) : (
            <button onClick={() => router.push('/buscar')} style={{ minHeight: 44, background: BRAND.blue, color: '#fff', border: 'none', padding: '10px 18px', borderRadius: 4, fontSize: 12, cursor: 'pointer', fontWeight: 500 }}>{t.dashboard.buscarProveedores}</button>
          )}
        </div>
      </div>

      {/* CONTENIDO POR MODO */}
      <div style={{padding: '20px 24px'}}>
        {enModoProveedor ? (
          <TabProveedor
            perfil={perfil}
            userEmail={user?.email}
            router={router}
            BRAND={BRAND}
            highlightBookingId={bookingHighlight}
            t={t}
          />
        ) : (
          <>
            {clientSubTab === 'cliente' && <TabCliente perfil={perfil} reservas={reservas} favoritos={favoritos} viajes={viajes} router={router} BRAND={BRAND} copiarLink={copiarLink} t={t} />}
            {clientSubTab === 'familia' && <TabFamilia perfil={perfil} router={router} BRAND={BRAND} t={t} />}
            {clientSubTab === 'pasaporte' && router.push('/pasaporte')}
            {clientSubTab === 'referidos' && <TabReferidos perfil={perfil} BRAND={BRAND} copiarLink={copiarLink} t={t} />}
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

function TabCliente({ perfil, reservas, favoritos, viajes, router, BRAND, copiarLink, t }) {
  const creditoDisponible = Number(perfil?.credito_disponible) || 0;

  return (
    <div>
    <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2 lg:grid-cols-3">
      {/* RESERVAS */}
      <div className="sm:col-span-2" style={{background: '#fff', borderRadius: 10, border: `0.5px solid ${BRAND.border}`, overflow: 'hidden'}}>
        <div style={{padding: '13px 16px', borderBottom: `0.5px solid #f0ede8`, display: 'flex', justifyContent: 'space-between', alignItems: 'center'}}>
          <span style={{fontSize: 11, fontWeight: 500, color: BRAND.dark}}>📅 {t.dashboard.misReservas}</span>
          <span style={{fontSize: 9, padding: '2px 7px', borderRadius: 8, background: '#e8f0fb', color: '#163a6b'}}>{reservas.filter(r => ['confirmada','pendiente','en_curso'].includes(r.estado)).length} {t.dashboard.activas}</span>
        </div>
        <div style={{padding: '13px 16px'}}>
          {reservas.length === 0 && (
            <div style={{ textAlign: 'center', padding: '20px 0' }}>
              <p style={{ fontSize: 13, color: '#888', margin: '0 0 12px' }}>
                {t.dashboard.sinReservasCliente}
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
                {t.dashboard.buscarServicio}
              </button>
            </div>
          )}
          {reservas.slice(0, 5).map(r => {
            const meta = getBookingStatusMeta(r.estado, { role: 'cliente' });
            const proveedorId = r.services?.proveedor_id;
            const showMensaje =
              meta.actions.includes('mensaje') && Boolean(proveedorId);
            return (
            <div key={r.id} style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: '0.5px solid #f5f3f0', gap: 8}}>
              <div style={{ minWidth: 0, flex: 1 }}>
                <div style={{fontSize: 12, color: BRAND.dark, fontWeight: 500}}>{r.services?.titulo} · {r.services?.profiles_public?.nombre}</div>
                <div style={{fontSize: 10, color: '#aaa', marginTop: 1}}>{r.fecha_inicio}{r.fecha_fin ? ` – ${r.fecha_fin}` : ''} · {r.precio_total}€</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 6 }}>
                  <a
                    href={`/reserva/${r.id}`}
                    style={{ fontSize: 10, fontWeight: 600, color: BRAND.blue, textDecoration: 'none' }}
                  >
                    {t.dashboard.verDetalle}
                  </a>
                  {showMensaje ? (
                    <ProveedorPreguntarButton
                      proveedorId={proveedorId}
                      className=""
                      style={{
                        fontSize: 10,
                        fontWeight: 600,
                        color: BRAND.blue,
                        background: 'transparent',
                        border: 'none',
                        padding: 0,
                        cursor: 'pointer',
                      }}
                    >
                      {t.dashboard.mensaje}
                    </ProveedorPreguntarButton>
                  ) : null}
                </div>
              </div>
              <BookingStatusBadge status={r.estado} role="cliente" size="sm" />
            </div>
            );
          })}
          <button onClick={() => router.push('/historial')} style={{ minHeight: 44, fontSize: 11, color: BRAND.blue, background: 'none', border: 'none', cursor: 'pointer', display: 'block', marginLeft: 'auto', marginTop: 8, padding: '8px 4px' }}>{t.dashboard.verHistorialCompleto}</button>
        </div>
      </div>

      {/* PERFIL */}
      <div style={{background: '#fff', borderRadius: 10, border: `0.5px solid ${BRAND.border}`, overflow: 'hidden'}}>
        <div style={{padding: '13px 16px', borderBottom: '0.5px solid #f0ede8'}}><span style={{fontSize: 11, fontWeight: 500, color: BRAND.dark}}>👤 {t.dashboard.miPerfil}</span></div>
        <div style={{padding: '13px 16px'}}>
          <div style={{display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10}}>
            <div style={{width: 40, height: 40, borderRadius: '50%', background: BRAND.blue, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, color: '#fff', fontWeight: 300}}>{(perfil?.nombre || 'U')[0]}</div>
            <div><div style={{fontSize: 13, fontWeight: 500, color: BRAND.dark}}>{perfil?.nombre} {perfil?.apellido}</div><div style={{fontSize: 10, color: '#aaa'}}>{perfil?.ciudad} · {t.dashboard.rolCliente}</div></div>
          </div>
          <div style={{display: 'flex', gap: 5, flexWrap: 'wrap', marginBottom: 10}}>
            {perfil?.codigo_referido && <span style={{fontSize: 8, padding: '2px 7px', borderRadius: 8, background: '#e8f0fb', color: '#163a6b'}}>{perfil.codigo_referido}</span>}
            {getReservasSinComisionCliente(perfil) > 0 && (
              <span style={{fontSize: 8, padding: '2px 7px', borderRadius: 8, background: '#e6f4f0', color: '#085041'}}>
                {getReservasSinComisionCliente(perfil)} {t.dashboard.sinComision}
              </span>
            )}
          </div>
          {creditoDisponible > 0 && (
            <p style={{ fontSize: 11, color: BRAND.green, fontWeight: 500, marginBottom: 10 }}>
              {t.dashboard.creditoDisponible} {creditoDisponible.toFixed(2)}€
            </p>
          )}
          <button onClick={() => router.push('/editar-perfil')} style={{ width: '100%', minHeight: 44, background: '#f7f5f2', color: BRAND.blue, border: `0.5px solid ${BRAND.blue}`, padding: '10px 8px', borderRadius: 5, fontSize: 10, cursor: 'pointer', fontWeight: 500 }}>{t.dashboard.editarPerfil}</button>
        </div>
      </div>

      {/* FAVORITOS */}
      <div style={{background: '#fff', borderRadius: 10, border: `0.5px solid ${BRAND.border}`, overflow: 'hidden'}}>
        <div style={{padding: '13px 16px', borderBottom: '0.5px solid #f0ede8', display: 'flex', justifyContent: 'space-between', alignItems: 'center'}}>
          <span style={{fontSize: 11, fontWeight: 500, color: BRAND.dark}}>❤️ {t.dashboard.favoritosTitulo}</span>
          <span style={{fontSize: 9, padding: '2px 7px', borderRadius: 8, background: '#fdf3e3', color: '#92400e'}}>{favoritos.length}</span>
        </div>
        <div style={{padding: '13px 16px'}}>
          {favoritos.length === 0 && (
            <EmptyState
              compact
              title={t.dashboard.sinFavoritosTitulo}
              description={t.dashboard.sinFavoritosDesc}
              actionLabel={t.dashboard.explorarServicios}
              actionHref="/buscar"
            />
          )}
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
        <div style={{padding: '13px 16px', borderBottom: '0.5px solid #f0ede8'}}><span style={{fontSize: 11, fontWeight: 500, color: BRAND.dark}}>🛂 {t.dashboard.miPasaporte}</span></div>
        <div style={{padding: 0}}>
          <div onClick={() => router.push('/pasaporte')} style={{background: 'linear-gradient(135deg, #1d4f91 0%, #163a6b 100%)', padding: 16, cursor: 'pointer'}}>
            <div style={{fontSize: 10, color: 'rgba(255,255,255,.5)', letterSpacing: '.06em', textTransform: 'uppercase', marginBottom: 6}}>Home&Heart · Pasaporte</div>
            <div style={{fontSize: 16, fontWeight: 300, color: '#fff', fontFamily: 'Georgia, serif', marginBottom: 10}}>{perfil?.nombre} {perfil?.apellido}</div>
            <div style={{display: 'flex', gap: 16}}>
              <div><div style={{fontSize: 18, fontWeight: 200, color: '#fff'}}>—</div><div style={{fontSize: 9, color: 'rgba(255,255,255,.5)'}}>{t.dashboard.pasaporteCiudades}</div></div>
              <div><div style={{fontSize: 18, fontWeight: 200, color: '#fff'}}>—</div><div style={{fontSize: 9, color: 'rgba(255,255,255,.5)'}}>{t.dashboard.pasaporteReservas}</div></div>
            </div>
            <div style={{fontSize: 10, color: 'rgba(255,255,255,.4)', marginTop: 10}}>{t.dashboard.verPasaporteCompleto}</div>
          </div>
        </div>
      </div>

      {/* VIAJES */}
      <div style={{background: '#fff', borderRadius: 10, border: `0.5px solid ${BRAND.border}`, overflow: 'hidden'}}>
        <div style={{padding: '13px 16px', borderBottom: '0.5px solid #f0ede8', display: 'flex', justifyContent: 'space-between'}}>
          <span style={{fontSize: 11, fontWeight: 500, color: BRAND.dark}}>✈️ {t.dashboard.misViajes}</span>
        </div>
        <div style={{padding: '13px 16px'}}>
          {viajes.length === 0 ? (
            <p style={{fontSize: 11, color: '#aaa'}}>{t.dashboard.organizaTusViajes}</p>
          ) : (
            viajes.map(viaje => (
              <Link key={viaje.id} href={`/viaje/${viaje.id}`} style={{display:'block', padding:'8px 0', borderBottom:'0.5px solid #f5f3f0', textDecoration:'none'}}>
                <div style={{fontSize:12, fontWeight:500, color:'#2a3a4a'}}>📍 {viaje.ciudad || viaje.nombre}</div>
                <div style={{fontSize:10, color:'#aaa'}}>{viaje.fecha_inicio} — {viaje.fecha_fin} · {viaje.viaje_reservas?.length || 0} {t.dashboard.serviciosSufijo}</div>
              </Link>
            ))
          )}
          <Link href="/viaje/nuevo" style={{fontSize:11, color:'#1d4f91', fontWeight:500, display:'block', marginTop:8}}>{t.dashboard.nuevoViaje}</Link>
        </div>
      </div>

      {/* REFERIDOS */}
      <div style={{background: '#fff', borderRadius: 10, border: `0.5px solid ${BRAND.border}`, overflow: 'hidden'}}>
        <div style={{padding: '13px 16px', borderBottom: '0.5px solid #f0ede8'}}><span style={{fontSize: 11, fontWeight: 500, color: BRAND.dark}}>🎁 {t.dashboard.referidosTitulo}</span></div>
        <div style={{padding: '13px 16px'}}>
          <div style={{background: '#f7f5f2', border: `0.5px solid ${BRAND.border}`, borderRadius: 6, padding: 10, display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8}}>
            <div><div style={{fontSize: 9, color: '#bbb', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 2}}>{t.dashboard.tuCodigo}</div><div style={{fontSize: 13, fontWeight: 500, color: BRAND.blue}}>{perfil?.codigo_referido || '—'}</div></div>
            <button onClick={() => copiarLink(perfil?.codigo_referido)} style={{ minHeight: 44, fontSize: 10, color: BRAND.blue, border: `0.5px solid ${BRAND.blue}`, padding: '8px 12px', borderRadius: 4, background: '#fff', cursor: 'pointer', whiteSpace: 'nowrap' }}>{t.dashboard.copiarLink}</button>
          </div>
          <p style={{fontSize: 10, color: '#888', lineHeight: 1.5}}>{t.dashboard.referidosInfoCorta}</p>
          <div style={{marginTop: 8, fontSize: 11, color: '#666', display: 'flex', justifyContent: 'space-between', padding: '5px 0', borderBottom: '0.5px solid #f5f3f0'}}><span>{t.dashboard.reservasSinComision}</span><span style={{fontWeight: 500, color: '#0e7a5c'}}>{getReservasSinComisionCliente(perfil)} 🎁</span></div>
        </div>
      </div>
    </div>
    <div style={{ marginTop: 14, textAlign: 'center' }}>
      <AyudaLink label={t.dashboard.necesitasAyudaSoporte} />
    </div>
    </div>
  );
}

function TabProveedor({ perfil, userEmail, router, BRAND, highlightBookingId, t }) {
  const deudaPendiente = Number(perfil?.deuda_pendiente) || 0;
  const saldoPendienteTransferir =
    Math.round((Number(perfil?.saldo_pendiente_transferir) || 0) * 100) / 100;
  const tieneCuentaCobros = Boolean(perfil?.stripe_account_id);
  const cobrosActivos = perfil?.cobros_activos === true;
  /** Cuenta Connect empezada pero aún no lista para cobrar */
  const cobrosIncompletos = tieneCuentaCobros && !cobrosActivos;
  const [connectLoading, setConnectLoading] = useState(false);
  const [connectError, setConnectError] = useState('');
  const weakListings = useWeakAlojamientoListings(perfil?.id);

  async function handleConfigureCobros() {
    setConnectLoading(true);
    setConnectError('');
    try {
      const res = await fetch('/api/stripe/connect/create-account', { method: 'POST' });
      const data = await res.json();
      if (!res.ok || data.error) {
        setConnectError(data.error || t.dashboard.cobrosErrorInicio);
        return;
      }
      if (data.url) {
        window.location.href = data.url;
        return;
      }
      setConnectError(t.dashboard.cobrosErrorUrl);
    } catch {
      setConnectError(t.dashboard.cobrosErrorConexion);
    } finally {
      setConnectLoading(false);
    }
  }

  return (
    <div style={{ maxWidth: 720, margin: '0 auto', padding: '0 4px' }}>
      {weakListings.length > 0 ? (
        <ListingWeakBanner
          titles={weakListings.map((w) => w.titulo)}
          href={weakListings[0].href}
        />
      ) : null}
      <ProviderFirstStepsChecklist
        perfil={perfil}
        accountEmail={userEmail}
        BRAND={BRAND}
        onConfigureCobros={handleConfigureCobros}
        configureCobrosLoading={connectLoading}
      />
      <ProviderListingChecklist perfil={perfil} BRAND={BRAND} />
      <div style={{ marginTop: 8, marginBottom: 4 }}>
        <AyudaLink
          highlighted={perfil?.verificado === true && !cobrosActivos}
          href={
            perfil?.verificado === true && !cobrosActivos
              ? '/ayuda?asunto=No%20puedo%20activar%20mi%20anuncio&destacado=1'
              : '/ayuda'
          }
          label={
            perfil?.verificado === true && !cobrosActivos
              ? t.dashboard.atascadoSoporte
              : t.dashboard.necesitasAyuda
          }
        />
      </div>
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
            {t.dashboard.compensacionTitulo}
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
            {t.dashboard.compensacionDesc1}{' '}
            {deudaPendiente.toFixed(2)}€. {t.dashboard.compensacionDesc2}
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
            {t.dashboard.cobroEnCaminoTitulo}
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
            {t.dashboard.cobroEnCaminoDesc1} {saldoPendienteTransferir.toFixed(2)}€ {t.dashboard.cobroEnCaminoDesc2}
          </p>
        </div>
      )}
      <div style={{ textAlign: 'center', padding: '24px 0 16px' }}>
        <div style={{ background: '#e6f4f0', borderRadius: 8, padding: '12px 16px', marginBottom: 16 }}>
          <div style={{ fontSize: 11, color: '#888', marginBottom: 4 }}>{t.dashboard.sinComisionTitulo}</div>
          <div style={{ fontSize: 20, fontWeight: 600, color: '#0e7a5c' }}>{getReservasSinComisionProveedor(perfil)} 🎁</div>
          <div style={{ fontSize: 10, color: '#666', marginTop: 4 }}>{t.dashboard.sinComisionSubtitulo}</div>
        </div>

        {!cobrosActivos ? (
          <div
            style={{
              marginBottom: 16,
              padding: '16px',
              borderRadius: 10,
              border: `1px solid ${
                perfil?.verificado === true ? BRAND.green : BRAND.blue
              }`,
              background: perfil?.verificado === true ? '#e6f4f0' : '#e8f0fb',
              textAlign: 'left',
            }}
          >
            <p
              style={{
                fontSize: 13,
                fontWeight: 700,
                color: perfil?.verificado === true ? '#085041' : '#2a3a4a',
                margin: 0,
              }}
            >
              {perfil?.verificado === true
                ? t.dashboard.anuncioAprobado
                : cobrosIncompletos
                  ? t.dashboard.cobrosPendientesCompletar
                  : t.dashboard.cobrosPendientes}
            </p>
            <p
              style={{
                fontSize: 12,
                color: perfil?.verificado === true ? '#085041' : '#444',
                marginTop: 8,
                marginBottom: 12,
                lineHeight: 1.5,
              }}
            >
              {perfil?.verificado === true
                ? cobrosIncompletos
                  ? t.dashboard.cobrosAprobadoCompletar
                  : t.dashboard.cobrosAprobadoConfigurar
                : cobrosIncompletos
                  ? t.dashboard.cobrosIncompletosDesc
                  : t.dashboard.cobrosSinActivar}
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
                fontSize: 13,
                fontWeight: 700,
                cursor: connectLoading ? 'not-allowed' : 'pointer',
                opacity: connectLoading ? 0.7 : 1,
              }}
            >
              {connectLoading
                ? t.dashboard.conectando
                : cobrosIncompletos
                  ? t.dashboard.completarCobros
                  : t.dashboard.configurarCobros}
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
            <p style={{ fontSize: 12, color: '#085041', margin: 0, fontWeight: 500 }}>
              {t.dashboard.cobrosActivos}
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
              {connectLoading ? t.dashboard.conectando : t.dashboard.gestionarCobros}
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

        <p style={{ fontSize: 14, color: '#aaa', marginBottom: 16 }}>{t.dashboard.labelPanelProveedor}</p>
        <button onClick={() => router.push('/estadisticas')} style={{ minHeight: 44, background: BRAND.blue, color: '#fff', border: 'none', padding: '10px 20px', borderRadius: 4, fontSize: 12, cursor: 'pointer', marginRight: 8 }}>{t.dashboard.verEstadisticasBtn}</button>
        <button onClick={() => router.push('/editar-perfil?tab=servicios')} style={{ minHeight: 44, background: '#fff', color: BRAND.blue, border: `1px solid ${BRAND.blue}`, padding: '10px 20px', borderRadius: 4, fontSize: 12, cursor: 'pointer' }}>{t.dashboard.editarServicios}</button>
      </div>
      <ReservasRecibidas
        perfil={perfil}
        BRAND={BRAND}
        highlightBookingId={highlightBookingId}
        router={router}
        t={t}
      />
    </div>
  );
}

const PRIMARY = '#1d4f91';
const GREEN = '#0e7a5c';
const AMBER = '#c47d1a';
const BORDER = '#e8e4de';

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

function formatImporteReservaRecibida(booking, sinComisionProveedor, t) {
  if (booking.pago_liberado_at != null) {
    if (booking.importe_transferido != null) {
      return {
        label: t.dashboard.cobradoLabel,
        amount: `${Number(booking.importe_transferido).toFixed(2)}€`,
      };
    }
    return { label: t.dashboard.cobradoLabel, amount: '—' };
  }
  return {
    label: t.dashboard.cobrasLabel,
    amount: `${getIngresoProveedorFromBooking(booking, { sinComisionProveedor }).toFixed(2)}€`,
  };
}

function ReservaRecibidaCard({
  booking,
  serviceTitulo,
  clienteNombre,
  clienteVerificado = false,
  clienteContacto = null,
  sinComisionProveedor,
  onRespond,
  responding,
  onCancelProvider,
  canceling,
  onIncidenciaReported,
  highlighted = false,
  t,
}) {
  const statusMeta = getBookingStatusMeta(booking.estado, { role: 'proveedor' });
  const isPendiente = booking.estado === 'pendiente';
  const isConfirmada = booking.estado === 'confirmada';
  const isIncidencia = booking.estado === 'incidencia';
  const canReport = statusMeta.canReportIncidencia || puedeReportarIncidencia(booking.estado);
  const canMensaje =
    statusMeta.actions.includes('mensaje') && Boolean(booking.cliente_id);
  const importeReserva = formatImporteReservaRecibida(booking, sinComisionProveedor, t);
  const showClienteContact = canShowProviderContact(booking.estado) && clienteContacto;

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
          <div
            style={{
              fontSize: 11,
              color: '#888',
              marginTop: 4,
              display: 'flex',
              flexWrap: 'wrap',
              alignItems: 'center',
              gap: 6,
            }}
          >
            <span>{clienteNombre}</span>
            {clienteVerificado && <ClienteVerificadoBadge compact />}
          </div>
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
          {showClienteContact && (
            <div
              style={{
                marginTop: 10,
                padding: '10px 12px',
                background: '#e8f0fb',
                borderRadius: 6,
                fontSize: 12,
                color: '#1d4f91',
                lineHeight: 1.5,
              }}
            >
              <div style={{ fontWeight: 600, fontSize: 11, marginBottom: 4 }}>
                {t.dashboard.contactoCliente}
              </div>
              {clienteContacto.telefono && (
                <div>
                  {t.dashboard.telefonoLabel}{' '}
                  <a
                    href={`tel:${clienteContacto.telefono}`}
                    style={{ color: '#1d4f91', fontWeight: 600 }}
                  >
                    {clienteContacto.telefono}
                  </a>
                </div>
              )}
              {(booking.lugar_servicio === 'casa_cliente' ||
                clienteContacto.direccion_cliente ||
                clienteContacto.direccion_cliente_a_definir === true) && (
                <div style={{ marginTop: 4 }}>
                  {clienteContacto.direccion_cliente
                    ? `${t.dashboard.direccionLabel} ${clienteContacto.direccion_cliente}`
                    : clienteContacto.direccion_cliente_a_definir
                      ? t.dashboard.direccionADefinir
                      : null}
                </div>
              )}
              {booking.lugar_servicio === 'casa_proveedor' && (
                <div style={{ marginTop: 4, fontSize: 11, color: '#666' }}>
                  {t.dashboard.servicioEnTuCasa}
                </div>
              )}
            </div>
          )}
        </div>
        <BookingStatusBadge status={booking.estado} role="proveedor" size="sm" />
      </div>
      <p
        style={{
          margin: '8px 0 0',
          fontSize: 11,
          color: '#666',
          lineHeight: 1.45,
        }}
      >
        {statusMeta.description}
      </p>
      <div style={{ display: 'flex', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
        <a
          href={`/reserva/${booking.id}`}
          style={{
            minHeight: 40,
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            flex: isPendiente || isConfirmada ? '0 0 auto' : 1,
            minWidth: 110,
            padding: '0 14px',
            background: '#fff',
            color: PRIMARY,
            border: `1px solid ${PRIMARY}`,
            borderRadius: 6,
            fontSize: 12,
            fontWeight: 600,
            textDecoration: 'none',
            boxSizing: 'border-box',
          }}
        >
          {t.dashboard.verDetalle}
        </a>
        {canMensaje ? (
          <ProveedorPreguntarButton
            proveedorId={booking.cliente_id}
            className=""
            style={{
              minHeight: 40,
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              flex: '0 0 auto',
              minWidth: 110,
              padding: '0 14px',
              background: '#fff',
              color: PRIMARY,
              border: `1px solid ${PRIMARY}`,
              borderRadius: 6,
              fontSize: 12,
              fontWeight: 600,
              cursor: 'pointer',
              boxSizing: 'border-box',
            }}
          >
            {t.dashboard.enviarMensaje}
          </ProveedorPreguntarButton>
        ) : null}
        {isPendiente && (
          <>
            <button
              type="button"
              disabled={responding}
              onClick={() => onRespond(booking.id, 'aceptar')}
              style={{
                minHeight: 40,
                flex: 1,
                minWidth: 100,
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
              {responding ? t.dashboard.procesando : t.dashboard.aceptar}
            </button>
            <button
              type="button"
              disabled={responding}
              onClick={() => onRespond(booking.id, 'rechazar')}
              style={{
                minHeight: 40,
                flex: 1,
                minWidth: 100,
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
              {responding ? t.dashboard.procesando : t.dashboard.rechazar}
            </button>
          </>
        )}
        {isConfirmada && (
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
            {canceling ? t.dashboard.cancelandoReserva : t.dashboard.cancelarReserva}
          </button>
        )}
      </div>
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
          {statusMeta.description}
        </p>
      )}
      {canReport && (
        <div style={{ marginTop: 12 }}>
          <p style={{ margin: '0 0 6px', fontSize: 11, fontWeight: 600, color: '#666' }}>
            {t.dashboard.problemaReserva}
          </p>
          <ReportarIncidenciaForm
            bookingId={booking.id}
            compact
            onSuccess={() => onIncidenciaReported?.(booking.id)}
          />
        </div>
      )}
      <div style={{ marginTop: 10 }}>
        <AyudaLink label={t.dashboard.ayudaGeneralCobros} />
      </div>
    </div>
  );
}

function ReservasRecibidas({ perfil, BRAND, highlightBookingId, router, t }) {
  const { toast, showSuccess, showError, dismiss } = useActionToast();
  const [bookings, setBookings] = useState([]);
  const [serviceMap, setServiceMap] = useState({});
  const [clientNames, setClientNames] = useState({});
  const [clientVerified, setClientVerified] = useState({});
  const [clienteContactos, setClienteContactos] = useState({});
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [actionError, setActionError] = useState('');
  const [actionSuccess, setActionSuccess] = useState('');
  const [stripeWarning, setStripeWarning] = useState('');
  const [respondingId, setRespondingId] = useState(null);
  const [cancelingId, setCancelingId] = useState(null);

  async function loadClienteContactos(bookingRows) {
    const ids = (bookingRows || [])
      .filter((b) => canShowProviderContact(b.estado))
      .map((b) => b.id);
    if (ids.length === 0) {
      setClienteContactos({});
      return;
    }
    try {
      const res = await fetch(
        `/api/bookings/cliente-contacto?ids=${ids.join(',')}`,
      );
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.contacts) {
        setClienteContactos(data.contacts);
      }
    } catch (err) {
      console.error('[ReservasRecibidas] contacto cliente', err);
    }
  }

  const [reloadKey, setReloadKey] = useState(0);

  const loadReservasRecibidas = useCallback(async () => {
    if (!perfil?.id) return;
    setLoading(true);
    setLoadError('');
    try {
      await withLoadTimeout((async () => {
        const { data: services, error: servicesError } = await supabase
          .from('services')
          .select('id, titulo')
          .eq('proveedor_id', perfil.id);

        if (servicesError) throw servicesError;

        const servicesList = services ?? [];
        const map = Object.fromEntries(servicesList.map((s) => [s.id, s.titulo || t.dashboard.servicioFallback]));
        setServiceMap(map);

        const serviceIds = servicesList.map((s) => s.id);

        if (serviceIds.length === 0) {
          setBookings([]);
          setClientNames({});
          setClientVerified({});
          setClienteContactos({});
          return;
        }

        const { data: bookingsData, error: bookingsError } = await supabase
          .from('bookings')
          .select('id, cliente_id, service_id, fecha_inicio, fecha_fin, hora, precio_total, precio_base, cliente_sin_comision, proveedor_sin_comision, estado, mensaje, created_at, pago_liberado_at, importe_transferido, lugar_servicio, direccion_cliente_a_definir')
          .in('service_id', serviceIds)
          .order('created_at', { ascending: false });

        if (bookingsError) throw bookingsError;

        const rows = bookingsData ?? [];
        setBookings(rows);
        await loadClienteContactos(rows);

        const clienteIds = [...new Set(rows.map((b) => b.cliente_id).filter(Boolean))];
        if (clienteIds.length > 0) {
          const { data: profiles, error: profilesError } = await supabase
            .from('profiles_public')
            .select('id, nombre, apellido, dni_verificado')
            .in('id', clienteIds);

          if (profilesError) {
            console.error('[ReservasRecibidas] Error perfiles cliente:', profilesError.message);
          }

          const names = {};
          const verified = {};
          for (const p of profiles ?? []) {
            const full = [p.nombre, p.apellido].filter(Boolean).join(' ').trim();
            names[p.id] = full || t.dashboard.clienteFallback;
            verified[p.id] = p.dni_verificado === true;
          }
          setClientNames(names);
          setClientVerified(verified);
        } else {
          setClientNames({});
          setClientVerified({});
        }
      })());
    } catch (err) {
      setLoadError(friendlyLoadError(err));
      setBookings([]);
    } finally {
      setLoading(false);
    }
  }, [perfil?.id, t]);

  useEffect(() => {
    loadReservasRecibidas();
  }, [loadReservasRecibidas, reloadKey]);

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
        ? t.dashboard.confirmarAceptar
        : t.dashboard.confirmarRechazar;
    if (!window.confirm(confirmMsg)) return;

    setRespondingId(bookingId);
    setActionError('');
    setActionSuccess('');
    setStripeWarning('');

    try {
      const res = await fetch('/api/bookings/respond', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bookingId, action }),
      });
      const data = await res.json();

      if (!res.ok || !data.success) {
        const msg = data.error || t.dashboard.errorProcesarReserva;
        setActionError(msg);
        showError(msg);
        return;
      }

      setBookings((prev) =>
        prev.map((b) => (b.id === bookingId ? { ...b, estado: data.estado } : b)),
      );

      const okMsg =
        action === 'aceptar'
          ? t.dashboard.reservaAceptada
          : t.dashboard.reservaRechazada;
      setActionSuccess(okMsg);
      showSuccess(okMsg);

      if (action === 'aceptar' && data.estado) {
        try {
          const contactRes = await fetch(
            `/api/bookings/cliente-contacto?ids=${bookingId}`,
          );
          const contactData = await contactRes.json().catch(() => ({}));
          if (contactRes.ok && contactData.contacts?.[bookingId]) {
            setClienteContactos((prev) => ({
              ...prev,
              [bookingId]: contactData.contacts[bookingId],
            }));
          }
        } catch {
          // ignore
        }
      }
    } catch (err) {
      const msg = err.message || t.dashboard.cobrosErrorConexion;
      setActionError(msg);
      showError(msg);
    } finally {
      setRespondingId(null);
    }
  }

  function handleIncidenciaReported(bookingId) {
    setBookings((prev) =>
      prev.map((b) => (b.id === bookingId ? { ...b, estado: 'incidencia' } : b)),
    );
    const msg = t.dashboard.incidenciaEnviada;
    setActionSuccess(msg);
    showSuccess(msg);
  }

  async function handleCancelProvider(bookingId) {
    if (!window.confirm(t.dashboard.confirmarCancelarProveedor)) {
      return;
    }

    setCancelingId(bookingId);
    setActionError('');
    setActionSuccess('');
    setStripeWarning('');

    try {
      const res = await fetch('/api/bookings/cancel-proveedor', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bookingId }),
      });
      const data = await res.json();

      if (!res.ok || !data.success) {
        const msg = data.error || t.dashboard.errorCancelarReserva;
        setActionError(msg);
        showError(msg);
        return;
      }

      setBookings((prev) =>
        prev.map((b) =>
          b.id === bookingId ? { ...b, estado: 'cancelada_proveedor' } : b,
        ),
      );

      setActionSuccess(t.dashboard.reservaCancelada);
      showSuccess(t.dashboard.reservaCancelada);

      if (data.stripe_ok === false) {
        setStripeWarning(
          data.stripe_error
            ? `${t.dashboard.stripeWarningPre} ${data.stripe_error}`
            : t.dashboard.stripeWarningGenerico,
        );
      }
    } catch (err) {
      const msg = err.message || t.dashboard.cobrosErrorConexion;
      setActionError(msg);
      showError(msg);
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
            📥 {t.dashboard.reservasRecibidas}
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
              {pendientes.length} {pendientes.length !== 1 ? t.dashboard.pendientes : t.dashboard.pendiente}
            </span>
          )}
        </div>

        <div style={{ padding: '13px 16px' }}>
          {loading && (
            <p style={{ fontSize: 12, color: '#aaa', textAlign: 'center', padding: '20px 0' }}>
              {t.dashboard.cargandoReservas}
            </p>
          )}

          {!loading && loadError && (
            <div style={{ textAlign: 'center', padding: '12px 0' }}>
              <p
                style={{
                  fontSize: 12,
                  color: '#b91c1c',
                  background: '#fee2e2',
                  padding: '10px 12px',
                  borderRadius: 6,
                  marginBottom: 10,
                }}
              >
                {loadError}
              </p>
              <button
                type="button"
                onClick={() => setReloadKey((k) => k + 1)}
                style={{
                  fontSize: 12,
                  fontWeight: 600,
                  color: '#fff',
                  background: BRAND.blue,
                  border: 'none',
                  borderRadius: 8,
                  padding: '10px 16px',
                  cursor: 'pointer',
                }}
              >
                {t.dashboard.reintentar}
              </button>
            </div>
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

          {!loading && !loadError && actionSuccess && (
            <p
              style={{
                fontSize: 12,
                color: '#065f46',
                background: '#ecfdf5',
                padding: '10px 12px',
                borderRadius: 6,
                marginBottom: 12,
              }}
            >
              {actionSuccess}
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
            <EmptyState
              compact
              title={t.dashboard.sinReservasProvTitulo}
              description={
                perfil?.verificado && perfil?.cobros_activos
                  ? t.dashboard.sinReservasProvActivo
                  : t.dashboard.sinReservasProvInactivo
              }
              actionLabel={
                perfil?.verificado && perfil?.cobros_activos
                  ? t.dashboard.irMisServicios
                  : t.dashboard.completarAlta
              }
              actionHref="/editar-perfil?tab=servicios"
            />
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
                {t.dashboard.requierenRespuesta}
              </p>
              {pendientes.map((booking) => (
                <ReservaRecibidaCard
                  key={booking.id}
                  booking={booking}
                  serviceTitulo={serviceMap[booking.service_id] || t.dashboard.servicioFallback}
                  clienteNombre={clientNames[booking.cliente_id] || t.dashboard.clienteFallback}
                  clienteVerificado={clientVerified[booking.cliente_id] === true}
                  clienteContacto={clienteContactos[booking.id] || null}
                  sinComisionProveedor={sinComisionProveedor}
                  onRespond={handleRespond}
                  responding={respondingId === booking.id}
                  onCancelProvider={handleCancelProvider}
                  canceling={cancelingId === booking.id}
                  onIncidenciaReported={handleIncidenciaReported}
                  highlighted={booking.id === highlightBookingId}
                  t={t}
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
                  {t.dashboard.historial}
                </p>
              )}
              {resto.map((booking) => (
                <ReservaRecibidaCard
                  key={booking.id}
                  booking={booking}
                  serviceTitulo={serviceMap[booking.service_id] || t.dashboard.servicioFallback}
                  clienteNombre={clientNames[booking.cliente_id] || t.dashboard.clienteFallback}
                  clienteVerificado={clientVerified[booking.cliente_id] === true}
                  clienteContacto={clienteContactos[booking.id] || null}
                  sinComisionProveedor={sinComisionProveedor}
                  onRespond={handleRespond}
                  responding={respondingId === booking.id}
                  onCancelProvider={handleCancelProvider}
                  canceling={cancelingId === booking.id}
                  onIncidenciaReported={handleIncidenciaReported}
                  highlighted={booking.id === highlightBookingId}
                  t={t}
                />
              ))}
            </>
          )}
        </div>
      </div>
      <ActionToastHost toast={toast} onDismiss={dismiss} />
    </div>
  );
}

function TabFamilia({ perfil, router, BRAND, t }) {
  return (
    <div style={{textAlign: 'center', padding: '40px 0'}}>
      <p style={{fontSize: 14, color: '#aaa', marginBottom: 16}}>{t.dashboard.gestionaFamilia}</p>
      <button onClick={() => router.push('/familia')} style={{ minHeight: 44, background: BRAND.blue, color: '#fff', border: 'none', padding: '10px 20px', borderRadius: 4, fontSize: 12, cursor: 'pointer' }}>{t.dashboard.irMiFamilia}</button>
    </div>
  );
}

function TabReferidos({ perfil, BRAND, copiarLink, t }) {
  return (
    <div style={{maxWidth: 480, margin: '0 auto', padding: '20px 0'}}>
      <div style={{background: '#fff', borderRadius: 10, border: `0.5px solid #e8e4de`, padding: 24}}>
        <h2 style={{fontSize: 16, fontWeight: 300, color: '#2a3a4a', fontFamily: 'Georgia, serif', marginBottom: 16}}>{t.dashboard.programaReferidos}</h2>
        <div style={{background: '#f7f5f2', border: '0.5px solid #e8e4de', borderRadius: 8, padding: 14, marginBottom: 14}}>
          <div style={{fontSize: 9, color: '#bbb', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 4}}>{t.dashboard.tuCodigoUnico}</div>
          <div style={{fontSize: 20, fontWeight: 500, color: BRAND.blue, letterSpacing: '.04em'}}>{perfil?.codigo_referido || '—'}</div>
        </div>
        <p style={{fontSize: 12, color: '#888', lineHeight: 1.7, marginBottom: 16}}>{t.dashboard.referidosDesc}</p>
        <div style={{background: '#e6f4f0', borderRadius: 6, padding: 12, marginBottom: 14}}>
          <div style={{fontSize: 11, color: '#085041', fontWeight: 500, marginBottom: 4}}>{t.dashboard.tusReservasSinComision}</div>
          <div style={{fontSize: 28, fontWeight: 200, color: '#0e7a5c'}}>{getReservasSinComisionCliente(perfil)}</div>
        </div>
        <button onClick={() => copiarLink(perfil?.codigo_referido)} style={{ width: '100%', minHeight: 44, background: BRAND.blue, color: '#fff', border: 'none', padding: 12, borderRadius: 5, fontSize: 12, cursor: 'pointer', fontWeight: 500 }}>{t.dashboard.copiarLinkInvitacion}</button>
      </div>
    </div>
  );
}
