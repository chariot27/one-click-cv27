"use client";

import { useState } from 'react';
import { useSession, signIn, signOut } from "next-auth/react";

export default function Dashboard() {
  const { data: session, status } = useSession();
  const [isGenerating, setIsGenerating] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [cookieSaved, setCookieSaved] = useState(false);
  const [liAtCookie, setLiAtCookie] = useState('');
  const [vanityName, setVanityName] = useState('');
  const [statusMsg, setStatusMsg] = useState('');
  // Extra contacts (optional overrides)
  const [extraPhone, setExtraPhone] = useState('');
  const [extraGithub, setExtraGithub] = useState('');
  const [extraTwitter, setExtraTwitter] = useState('');
  const [extraWebsite, setExtraWebsite] = useState('');

  const handleSaveCookie = async () => {
    if (!liAtCookie || !vanityName) {
      setStatusMsg('Preencha os dois campos primeiro.');
      return;
    }
    setIsSaving(true);
    setStatusMsg('');
    try {
      const vName = vanityName.includes('linkedin.com')
        ? vanityName.replace(/.*\/in\//, '').replace(/\/$/, '')
        : vanityName.trim();

      const res = await fetch('/api/save-cookie', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ liAtCookie: liAtCookie.trim(), vanityName: vName }),
      });
      if (res.ok) {
        setCookieSaved(true);
        setStatusMsg('Cookie salvo. Clique em "Download PDF Resume".');
      } else {
        setStatusMsg('Erro ao salvar cookie. Tente novamente.');
      }
    } catch (e) {
      setStatusMsg('Erro: ' + e.message);
    } finally {
      setIsSaving(false);
    }
  };

  const handleGenerate = async () => {
    setIsGenerating(true);
    setStatusMsg('Obtendo dados do LinkedIn e otimizando para ATS...');
    try {
      const res = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          liAtCookie: liAtCookie.trim(),
          vanityName: vanityName.trim(),
          extraContacts: {
            phone: extraPhone,
            github: extraGithub,
            twitter: extraTwitter,
            website: extraWebsite,
          },
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        if (err.error === 'setup_required') {
          setStatusMsg('Preencha o cookie e o vanity name antes de gerar.');
          setIsGenerating(false);
          return;
        }
        throw new Error(err.error || 'Falha ao processar perfil');
      }

      const { data, atsScore } = await res.json();
      setStatusMsg('Gerando arquivo PDF Premium...');

      // Import jsPDF dynamically
      const { jsPDF } = await import('jspdf');
      const doc = new jsPDF();
      const primaryColor = [26, 58, 110]; // #1a3a6e
      const textColor = [34, 34, 34];
      const lightGray = [120, 120, 120];

      // Helper for sections
      const drawSectionTitle = (title, x, y, width) => {
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(10);
        doc.setTextColor(...primaryColor);
        doc.text(title.toUpperCase(), x, y);
        doc.setDrawColor(...primaryColor);
        doc.setLineWidth(0.5);
        doc.line(x, y + 2, x + width, y + 2);
        return y + 10;
      };

      // HEADER
      let y = 20;
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(26);
      doc.setTextColor(0, 0, 0);
      doc.text(data.name || 'SEU NOME', 105, y, { align: 'center' });
      
      y += 10;
      doc.setFontSize(11);
      doc.setTextColor(...primaryColor);
      doc.text(data.headline || '', 105, y, { align: 'center' });
      
      y += 8;
      doc.setFontSize(9);
      doc.setTextColor(...textColor);
      const contactInfo = [data.email, data.phone, data.linkedin ? 'linkedin.com/in/' + data.linkedin.replace(/.*\/in\//, '') : '', data.github ? 'github.com/' + data.github.replace(/.*github\.com\//, '') : ''].filter(Boolean).join('  |  ');
      doc.text(contactInfo, 105, y, { align: 'center' });
      
      y += 10;
      doc.setDrawColor(...primaryColor);
      doc.setLineWidth(0.8);
      doc.line(20, y, 190, y);
      
      const contentStartY = y + 15;
      
      // LEFT COLUMN (Sidebar - Width: 60)
      const col1X = 20;
      const col1Width = 55;
      let yL = contentStartY;

      // Technical Skills
      if (data.skills?.length > 0) {
        yL = drawSectionTitle('Technical Skills', col1X, yL, col1Width);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(9);
        doc.setTextColor(...textColor);
        data.skills.forEach(skill => {
          doc.text('• ' + skill, col1X, yL);
          yL += 5;
        });
        yL += 10;
      }

      // Education
      if (data.education?.length > 0) {
        yL = drawSectionTitle('Education', col1X, yL, col1Width);
        data.education.forEach(edu => {
          doc.setFont('helvetica', 'bold');
          doc.setFontSize(9);
          doc.setTextColor(0, 0, 0);
          const splitSchool = doc.splitTextToSize(edu.school, col1Width);
          doc.text(splitSchool, col1X, yL);
          yL += (splitSchool.length * 4.5);
          
          doc.setFont('helvetica', 'normal');
          doc.setFontSize(8);
          doc.setTextColor(...lightGray);
          doc.text(edu.degree || '', col1X, yL);
          yL += 5;
        });
      }

      // RIGHT COLUMN (Main - Width: 110)
      const col2X = 85;
      const col2Width = 105;
      let yR = contentStartY;

      // Professional Summary
      if (data.summary) {
        yR = drawSectionTitle('Professional Summary', col2X, yR, col2Width);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(9);
        doc.setTextColor(60, 60, 60);
        const splitSummary = doc.splitTextToSize(data.summary, col2Width);
        doc.text(splitSummary, col2X, yR);
        yR += (splitSummary.length * 5) + 12;
      }

      // Work Experience
      if (data.experiences?.length > 0) {
        yR = drawSectionTitle('Work Experience', col2X, yR, col2Width);
        data.experiences.forEach(exp => {
          if (yR > 260) { doc.addPage(); yR = 20; }
          
          doc.setFont('helvetica', 'bold');
          doc.setFontSize(10);
          doc.setTextColor(0, 0, 0);
          doc.text(exp.role, col2X, yR);
          
          doc.setFont('helvetica', 'normal');
          doc.setFontSize(9);
          doc.setTextColor(...primaryColor);
          const periodWidth = doc.getTextWidth(exp.period || '');
          doc.text(exp.period || '', col2X + col2Width - periodWidth, yR);
          
          yR += 5;
          doc.setFont('helvetica', 'bold');
          doc.setFontSize(9);
          doc.setTextColor(60, 60, 60);
          doc.text(exp.company, col2X, yR);
          
          yR += 5;
          if (exp.description) {
            doc.setFont('helvetica', 'normal');
            doc.setFontSize(8.5);
            doc.setTextColor(80, 80, 80);
            const splitDesc = doc.splitTextToSize(exp.description, col2Width);
            doc.text(splitDesc, col2X, yR);
            yR += (splitDesc.length * 4.5);
          }
          yR += 8;
        });
      }

      // Certifications
      if (data.certifications?.length > 0) {
        if (yR > 250) { doc.addPage(); yR = 20; }
        yR = drawSectionTitle('Licenses & Certifications', col2X, yR, col2Width);
        data.certifications.forEach(cert => {
          doc.setFont('helvetica', 'bold');
          doc.setFontSize(9);
          doc.setTextColor(0, 0, 0);
          doc.text(cert.name, col2X, yR);
          yR += 4.5;
          doc.setFont('helvetica', 'normal');
          doc.setFontSize(8);
          doc.setTextColor(...lightGray);
          doc.text(cert.authority || '', col2X, yR);
          yR += 6;
        });
      }

      // FOOTER
      const pageCount = doc.internal.getNumberOfPages();
      for(let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        doc.setFontSize(8);
        doc.setTextColor(180, 180, 180);
        doc.text(`Score ATS: ${atsScore}/100 | Gerado por One-Click CV`, 105, 285, { align: 'center' });
      }

      doc.save(`${data.name.replace(/\s+/g, '_')}_Resume.pdf`);
      setStatusMsg(`Currículo Premium gerado com Score ATS: ${atsScore}/100!`);
    } catch (e) {
      console.error(e);
      setStatusMsg('Erro ao gerar PDF: ' + e.message);
    } finally {
      setIsGenerating(false);
    }
  };


  if (status === 'loading') return <div className="container">Loading...</div>;

  if (status === 'unauthenticated') {
    return (
      <main className="container flex-center" style={{ height: '100vh', flexDirection: 'column' }}>
        <h2 style={{ marginBottom: 'var(--space-md)' }}>Please sign in to continue</h2>
        <button className="btn-primary" onClick={() => signIn('linkedin')}>Login with LinkedIn</button>
      </main>
    );
  }

  return (
    <main className="container animate-fade" style={{ padding: 'var(--space-lg) 0' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-lg)', flexWrap: 'wrap', gap: 'var(--space-sm)' }}>
        <h1>Área do <span className="gradient-text">Usuário</span></h1>
        <div style={{ display: 'flex', gap: 'var(--space-sm)' }}>
          <a
            href="https://www.vakinha.com.br/vaquinha/desafio-1-dev-1000-saas"
            target="_blank"
            rel="noopener noreferrer"
            className="btn-primary"
            style={{ background: 'linear-gradient(135deg, #f97316, #ef4444)', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
          >
            Apoiar o projeto
          </a>
          <button className="btn-primary" onClick={handleGenerate} disabled={isGenerating}>
            {isGenerating ? 'Baixando...' : 'Baixar Currículo PDF'}
          </button>
          <button className="btn-primary" onClick={() => signOut()} style={{ background: 'transparent', border: '1px solid var(--border)' }}>Sair</button>
        </div>
      </div>

      {/* Status message */}
      {statusMsg && (
        <div style={{ marginBottom: 'var(--space-md)', padding: '0.75rem 1rem', borderRadius: '10px', background: 'rgba(100,255,218,0.07)', border: '1px solid var(--border)', color: 'var(--text-main)' }}>
          {statusMsg}
        </div>
      )}

      <div style={{ maxWidth: '600px', margin: '0 auto' }}>
        {/* Setup */}
        <div className="glass-card">
          <h2 style={{ marginBottom: 'var(--space-sm)' }}>Configuração do Perfil</h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-sm)' }}>

            {/* User info */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '0.75rem', background: 'rgba(0,0,0,0.2)', borderRadius: '12px' }}>
              {session.user.image && <img src={session.user.image} alt="avatar" style={{ width: 44, height: 44, borderRadius: '50%' }} />}
              <div>
                <p style={{ fontWeight: 'bold', color: 'var(--secondary)' }}>{session.user.name}</p>
                <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>{session.user.email}</p>
              </div>
            </div>

            <div style={{ padding: '0.75rem', background: 'rgba(255,200,0,0.07)', borderRadius: '10px', border: '1px solid rgba(255,200,0,0.3)' }}>
              <p style={{ fontSize: '0.82rem', color: '#ffd700' }}>
                Configuração única: pegue seu cookie li_at (F12 → Application → Cookies) e o seu vanity name (parte após /in/ na URL do perfil).
              </p>
            </div>

            <label style={{ fontSize: '0.85rem', fontWeight: 'bold', color: 'var(--text-muted)' }}>LinkedIn vanity name:</label>
            <input
              type="text"
              placeholder=""
              value={vanityName}
              onChange={e => setVanityName(e.target.value)}
              style={{ padding: '0.7rem', borderRadius: '10px', border: '1px solid var(--border)', background: 'var(--bg-dark)', color: 'var(--text-main)' }}
            />

            <label style={{ fontSize: '0.85rem', fontWeight: 'bold', color: 'var(--text-muted)' }}>li_at cookie value:</label>
            <input
              type="password"
              placeholder="Cole o cookie li_at aqui"
              value={liAtCookie}
              onChange={e => setLiAtCookie(e.target.value)}
              style={{ padding: '0.7rem', borderRadius: '10px', border: '1px solid var(--border)', background: 'var(--bg-dark)', color: 'var(--text-main)' }}
            />

            <button
              className="btn-primary"
              onClick={handleSaveCookie}
              disabled={isSaving || !liAtCookie || !vanityName}
              style={{ background: cookieSaved ? 'var(--secondary)' : undefined, color: cookieSaved ? '#000' : undefined }}
            >
              {isSaving ? 'Salvando...' : cookieSaved ? 'Cookie salvo — clique em Download acima' : 'Salvar cookie'}
            </button>

            {/* Extra Social Networks */}
            <div style={{ marginTop: 'var(--space-sm)', borderTop: '1px solid var(--border)', paddingTop: 'var(--space-sm)' }}>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '0.5rem' }}>Opcional: Contatos extras (GitHub, Twitter, etc)</p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                <input type="text" placeholder="Telefone (ex: +55 51 99999-9999)" value={extraPhone} onChange={e => setExtraPhone(e.target.value)}
                  style={{ padding: '0.6rem', borderRadius: '8px', border: '1px solid var(--border)', background: 'var(--bg-dark)', color: 'var(--text-main)', fontSize: '0.85rem' }} />
                <input type="text" placeholder="GitHub URL" value={extraGithub} onChange={e => setExtraGithub(e.target.value)}
                  style={{ padding: '0.6rem', borderRadius: '8px', border: '1px solid var(--border)', background: 'var(--bg-dark)', color: 'var(--text-main)', fontSize: '0.85rem' }} />
                <input type="text" placeholder="Twitter / X URL" value={extraTwitter} onChange={e => setExtraTwitter(e.target.value)}
                  style={{ padding: '0.6rem', borderRadius: '8px', border: '1px solid var(--border)', background: 'var(--bg-dark)', color: 'var(--text-main)', fontSize: '0.85rem' }} />
                <input type="text" placeholder="Site pessoal" value={extraWebsite} onChange={e => setExtraWebsite(e.target.value)}
                  style={{ padding: '0.6rem', borderRadius: '8px', border: '1px solid var(--border)', background: 'var(--bg-dark)', color: 'var(--text-main)', fontSize: '0.85rem' }} />
              </div>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
