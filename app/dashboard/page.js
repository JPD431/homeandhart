'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Navbar from '@/app/components/Navbar';
import { supabase } from '@/app/lib/supabase';

const BRAND = {
  blue: '#1d4f91',
  green: '#0e7a5c', 
  amber: '#c47d1a',
  warm: '#f7f5f2',
  border: '#e8e4de',
  dark: '#2a3a4a'
};

export default function DashboardPage() {
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [perfil, setPerfil] = useState(null);
  const [reservas, setReservas] = useState([]);
  const [favoritos, setFavoritos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tabActiva, setTabActiva] = useState('cliente');

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
      const { data: r } = await supabase.from('bookings').select('*, services(titulo, vertical, proveedor_id, profiles!proveedor_id(nombre, apellido))').eq('cliente_id', user.id).order('created_at', { ascending: false }).limit(10);
      setReservas(r || []);
      const { data: f } = await supabase.from('favoritos').select('*, profiles!proveedor_id(id, nombre, apellido)').eq('cliente_id', user.id);
      setFavoritos(f || []);
      setLoading(false);
    }
    load();
  }, []);

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
  const tabs = ['cliente', 'proveedor', 'familia', 'pasaporte', 'referidos'];

  return (
    <div style={{background: BRAND.warm, minHeight: '100vh'}}>
      <Navbar />
      
      {/* TABS */}
      <div
        className="flex overflow-x-auto [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden"
        style={{ background: '#fff', borderBottom: `0.5px solid ${BRAND.border}`, padding: '0 16px' }}
      >
        {tabs.map(t => (
          <button
            key={t}
            onClick={() => setTabActiva(t)}
            className="shrink-0"
            style={{
              minHeight: 44,
              padding: '12px 20px',
              fontSize: 12,
              color: tabActiva === t ? BRAND.blue : '#888',
              borderBottom: tabActiva === t ? `2px solid ${BRAND.blue}` : '2px solid transparent',
              fontWeight: tabActiva === t ? 500 : 400,
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

      {/* HEADER */}
      <div
        className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between"
        style={{ background: '#fff', borderBottom: `0.5px solid ${BRAND.border}`, padding: '20px 16px' }}
      >
        <div>
          <div style={{ fontSize: 'clamp(22px, 4vw, 26px)', fontWeight: 300, color: BRAND.dark, fontFamily: 'Georgia, serif' }}>Hola, <em style={{color: BRAND.blue}}>{nombreMostrar}.</em></div>
          <div style={{fontSize: 12, color: '#aaa', marginTop: 4}}>Bienvenida a tu panel · Home&Heart</div>
        </div>
        <div className="flex flex-wrap gap-2">
          <button onClick={() => router.push('/editar-perfil')} style={{ minHeight: 44, background: '#fff', color: BRAND.blue, border: `1px solid ${BRAND.blue}`, padding: '10px 18px', borderRadius: 4, fontSize: 12, cursor: 'pointer' }}>Editar perfil</button>
          <button onClick={() => router.push('/buscar')} style={{ minHeight: 44, background: BRAND.blue, color: '#fff', border: 'none', padding: '10px 18px', borderRadius: 4, fontSize: 12, cursor: 'pointer', fontWeight: 500 }}>Buscar proveedores</button>
        </div>
      </div>

      {/* CONTENIDO POR TAB */}
      <div style={{padding: '20px 24px'}}>
        {tabActiva === 'cliente' && <TabCliente perfil={perfil} reservas={reservas} favoritos={favoritos} router={router} BRAND={BRAND} copiarLink={copiarLink} />}
        {tabActiva === 'proveedor' && <TabProveedor perfil={perfil} router={router} BRAND={BRAND} />}
        {tabActiva === 'familia' && <TabFamilia perfil={perfil} router={router} BRAND={BRAND} />}
        {tabActiva === 'pasaporte' && router.push('/pasaporte')}
        {tabActiva === 'referidos' && <TabReferidos perfil={perfil} BRAND={BRAND} copiarLink={copiarLink} />}
      </div>
    </div>
  );
}

function TabCliente({ perfil, reservas, favoritos, router, BRAND, copiarLink }) {
  return (
    <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2 lg:grid-cols-3">
      {/* RESERVAS */}
      <div className="sm:col-span-2" style={{background: '#fff', borderRadius: 10, border: `0.5px solid ${BRAND.border}`, overflow: 'hidden'}}>
        <div style={{padding: '13px 16px', borderBottom: `0.5px solid #f0ede8`, display: 'flex', justifyContent: 'space-between', alignItems: 'center'}}>
          <span style={{fontSize: 11, fontWeight: 500, color: BRAND.dark}}>📅 Mis reservas</span>
          <span style={{fontSize: 9, padding: '2px 7px', borderRadius: 8, background: '#e8f0fb', color: '#163a6b'}}>{reservas.filter(r => ['confirmada','pendiente','en_curso'].includes(r.estado)).length} activas</span>
        </div>
        <div style={{padding: '13px 16px'}}>
          {reservas.length === 0 && <p style={{fontSize: 12, color: '#bbb', textAlign: 'center', padding: '16px 0'}}>No tienes reservas todavía</p>}
          {reservas.slice(0, 5).map(r => (
            <div key={r.id} style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: '0.5px solid #f5f3f0'}}>
              <div>
                <div style={{fontSize: 12, color: BRAND.dark, fontWeight: 500}}>{r.services?.titulo} · {r.services?.profiles?.nombre}</div>
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
            {perfil?.reservas_sin_comision > 0 && <span style={{fontSize: 8, padding: '2px 7px', borderRadius: 8, background: '#e6f4f0', color: '#085041'}}>{perfil.reservas_sin_comision} sin comisión 🎁</span>}
          </div>
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
              <div style={{width: 32, height: 32, borderRadius: '50%', background: BRAND.blue, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 500, color: '#fff', flexShrink: 0}}>{(f.profiles?.nombre || 'P')[0]}</div>
              <div style={{flex: 1}}><div style={{fontSize: 12, color: BRAND.dark, fontWeight: 500}}>{f.profiles?.nombre} {f.profiles?.apellido}</div></div>
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
          <p style={{fontSize: 12, color: '#bbb', textAlign: 'center', padding: '8px 0', marginBottom: 8}}>Organiza todos tus servicios en un viaje</p>
          <button onClick={() => router.push('/viaje/nuevo')} style={{ width: '100%', minHeight: 44, background: BRAND.blue, color: '#fff', border: 'none', padding: '10px 8px', borderRadius: 5, fontSize: 10, cursor: 'pointer', fontWeight: 500 }}>+ Nuevo viaje</button>
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
          <div style={{marginTop: 8, fontSize: 11, color: '#666', display: 'flex', justifyContent: 'space-between', padding: '5px 0', borderBottom: '0.5px solid #f5f3f0'}}><span>Reservas sin comisión</span><span style={{fontWeight: 500, color: '#0e7a5c'}}>{perfil?.reservas_sin_comision || 0} 🎁</span></div>
        </div>
      </div>
    </div>
  );
}

function TabProveedor({ perfil, router, BRAND }) {
  return (
    <div style={{textAlign: 'center', padding: '40px 0'}}>
      <p style={{fontSize: 14, color: '#aaa', marginBottom: 16}}>Panel de proveedor</p>
      <button onClick={() => router.push('/estadisticas')} style={{ minHeight: 44, background: BRAND.blue, color: '#fff', border: 'none', padding: '10px 20px', borderRadius: 4, fontSize: 12, cursor: 'pointer', marginRight: 8 }}>Ver estadísticas</button>
      <button onClick={() => router.push('/editar-perfil')} style={{ minHeight: 44, background: '#fff', color: BRAND.blue, border: `1px solid ${BRAND.blue}`, padding: '10px 20px', borderRadius: 4, fontSize: 12, cursor: 'pointer' }}>Editar servicios</button>
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
          <div style={{fontSize: 28, fontWeight: 200, color: '#0e7a5c'}}>{perfil?.reservas_sin_comision || 0}</div>
        </div>
        <button onClick={() => copiarLink(perfil?.codigo_referido)} style={{ width: '100%', minHeight: 44, background: BRAND.blue, color: '#fff', border: 'none', padding: 12, borderRadius: 5, fontSize: 12, cursor: 'pointer', fontWeight: 500 }}>Copiar link de invitación</button>
      </div>
    </div>
  );
}
