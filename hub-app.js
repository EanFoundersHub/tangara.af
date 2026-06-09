(() => {
  "use strict";

  const CONFIG = window.S2V_CONFIG || {};
  const CONFIG_PLACEHOLDER = "PEGA_AQUI_LA_URL_HTTP_DEL_FLUJO_S2V_02";
  const STORAGE_KEYS = { apiUrl: "s2v_api_consultar_datos_url", session: "s2v_session" };

  const EVAL_CRITERIA = [
    { key: "calidadCientifica", label: "Calidad científica", max: 300, color: "#55c9cc" },
    { key: "mercado", label: "Potencial de mercado", max: 300, color: "#7be1e4" },
    { key: "innovacionPI", label: "Innovación / PI", max: 200, color: "#2ea8ab" },
    { key: "equipo", label: "Equipo", max: 150, color: "#d4a853" },
    { key: "impacto", label: "Impacto sostenible", max: 50, color: "#6bdfb0" }
  ];
  const RING_CIRCUMFERENCE = 2 * Math.PI * 52;

  const state = {
    raw: null, postulaciones: [], controlDocumental: [], miembrosEquipo: [],
    filtered: [], selectedId: null, session: null
  };

  const $ = (s) => document.querySelector(s);
  const $$ = (s) => Array.from(document.querySelectorAll(s));

  const els = {
    loginView: $("#loginView"), dashboardView: $("#dashboardView"),
    loginForm: $("#loginForm"), correoEvaluador: $("#correoEvaluador"),
    codigoAcceso: $("#codigoAcceso"), loginMessage: $("#loginMessage"),
    apiUrlInput: $("#apiUrlInput"), saveApiUrlBtn: $("#saveApiUrlBtn"),
    setupPanel: $("#setupPanel"), /* may be null if removed */ userEmailLabel: $("#userEmailLabel"),
    logoutBtn: $("#logoutBtn"),
    metricPostulaciones: $("#metricPostulaciones"), metricControl: $("#metricControl"),
    metricMiembros: $("#metricMiembros"), metricEquidad: $("#metricEquidad"),
    searchInput: $("#searchInput"), routeFilter: $("#routeFilter"),
    statusFilter: $("#statusFilter"), reloadBtn: $("#reloadBtn"),
    initiativeList: $("#initiativeList"), visibleCount: $("#visibleCount"),
    detailPanel: $("#detailPanel"), cardTemplate: $("#initiativeCardTemplate"),
    convocatoriaResumen: $("#convocatoriaResumen")
  };

  /* ── Utilities ── */
  function choice(value, fallback = "Pendiente") {
    if (value === null || value === undefined || value === "") return fallback;
    if (typeof value === "object") {
      if ("Value" in value) return clean(value.Value) || fallback;
      if ("value" in value) return clean(value.value) || fallback;
      if ("Title" in value) return clean(value.Title) || fallback;
    }
    return clean(String(value)) || fallback;
  }
  function clean(v) { if (v == null) return ""; return String(v).replace(/\s+/g, " ").replace(/\s+\./g, ".").trim(); }
  function shortText(v, max = 110) { const t = clean(v); if (!t) return "Sin información."; return t.length > max ? t.slice(0, max).trim() + "…" : t; }
  function boolText(v) { if (v === true) return "Sí"; if (v === false) return "No"; return choice(v, "Pendiente"); }
  function routeOf(item) { return choice(item.RutaTRL_x007c_ || item.RutaTRL || item.RutaTRLValue, "Pendiente"); }
  function trlOf(item) { return choice(item.TRLDeclarado || item.TRLValidadoFinal || item.TRL, "Pendiente"); }
  function statusOf(item) { return choice(item.EstadoPostulacion || item.EstadoResultado || item.Estado, "Pendiente"); }
  function initiativeIdOf(item) { return clean(item.IDIniciativa || item.Title || item.NombreIniciativa || item.ID || "Sin ID"); }
  function initiativeNameOf(item) { return clean(item.NombreIniciativa || item.Title || item["{Name}"] || item.IDIniciativa || "Iniciativa sin nombre"); }
  function esc(v) { return clean(v).replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;").replaceAll('"',"&quot;").replaceAll("'","&#039;"); }

  function normalizeData(data) {
    return {
      postulaciones: Array.isArray(data?.postulaciones) ? data.postulaciones : [],
      controlDocumental: Array.isArray(data?.controlDocumental) ? data.controlDocumental : [],
      miembrosEquipo: Array.isArray(data?.miembrosEquipo) ? data.miembrosEquipo : []
    };
  }

  function getConfiguredApiUrl() {
    const stored = localStorage.getItem(STORAGE_KEYS.apiUrl);
    const fromCfg = CONFIG.API_CONSULTAR_DATOS_URL;
    const c = stored || fromCfg || "";
    if (!c || c === CONFIG_PLACEHOLDER) return "";
    return c.trim();
  }

  function setMessage(text, type = "") {
    els.loginMessage.textContent = text || "";
    els.loginMessage.className = `message ${type}`.trim();
  }

  /* ── API (modo demo estático basado en Excel) ── */
  async function fetchData(session) {
    const apiUrl = getConfiguredApiUrl();

    const DEMO_DATA = {
      "ok": true,
      "modo": "demo_estatico_excel",
      "mensaje": "Modo demo estático cargado con 18 postulaciones reales depuradas del Excel. Pruebas excluidas.",
      "demoMeta": {
            "totalPostulaciones": 18,
            "pruebasExcluidas": 5,
            "fuente": "SCIENCE2VENTURE EAN IMPACTA.xlsx",
            "notaPrivacidad": "Correos y enlaces documentales fueron enmascarados en esta versión demo para evitar exposición pública."
      },
      "postulaciones": [
            {
                  "IDOriginal": "2",
                  "IDIniciativa": "S2V-2026-001",
                  "NombreIniciativa": "Polen Hub",
                  "NombreLider": "Cristian David Rivillas Mejia",
                  "CorreoLider": "c***s@universidadean.edu.co",
                  "Ciudad": "Bogota",
                  "VinculacionLider": "Profesor / Investigador",
                  "FacultadArea": "Facultad de Administración, Finanzas y Ciencias Económicas",
                  "RolIniciativa": "Desarrollador",
                  "SurgeGrupoSemillero": "Sí, de un semillero",
                  "GrupoOSemillero": "Inglomark",
                  "AreaConocimiento": "Ingeniería y tecnología",
                  "EnfoqueProyecto": "Base tecnológica",
                  "DescripcionCorta": "Polen HUB es un AI-powered Knowledge Marketplace diseñado para transformar la educación superior en un motor activo de desarrollo territorial. A través de nuestro algoritmo de matching semántico potenciado por inteligencia artificial (Meli AI), la plataforma orquesta y automatiza la conexión entre los desafíos reales del territorio y los microcurrículos universitarios (Syllabus). Con este enfoque, eliminamos la fricción administrativa y la desconexión histórica del aula con la realidad, permitiendo que pymes y comunidades rurales con baja alfabetización digital reporten sus retos de forma directa y sencilla para acceder a soluciones. Al descentralizar e inyectar el saber aplicado directamente en las regiones, no solo democratizamos el conocimiento, sino que aceleramos la empleabilidad estudiantil mediante micro-credenciales verificadas en Blockchain, todo bajo un modelo de sostenibilidad circular autosustentado por patrocinio corporativo B2B.",
                  "PosturaEquityEan": "Si estoy de acuerdo con que la Universidad tenga participación.",
                  "AnioInicioTecnologia": "2025",
                  "TRLDeclarado": "TRL 3 Validación en laboratorio",
                  "TRLNum": 3,
                  "RutaTRL": "TRL 1-3",
                  "CRLDeclarado": "CRL 2 Conocimiento del mercado",
                  "CRLNum": 2,
                  "BRLDeclarado": "BRL 3 Construir equipo y planificar",
                  "BRLNum": 3,
                  "EvidenciasTRL": "Todavía no tenemos evidencias documentadas. ;",
                  "EntornoPruebaTecnologia": "Todavía no la he probado físicamente (solo en papel, modelado o simulación).",
                  "BrechaTecnicaPrincipal": "Construir el primer prototipo integrado (combinar los componentes en un solo sistema).",
                  "TipoTecnologia": "Desarrollo una plataforma digital propia (app, sistema, marketplace) como base del negocio.",
                  "OrigenTecnologia": "Combinamos varias tecnologías existentes para crear algo nuevo que antes no existía así.",
                  "ComplejidadTecnica": "Medio",
                  "EvidenciasDocumentadas": "Sí, cuento con evidencias documentadas que pueden ser revisadas en esta convocatoria.",
                  "EvidenciasURL": "https://example.com/s2v-2026-001/evidencias",
                  "OrigenProblema": "Identificamos el problema por experiencia directa de alguien del equipo en ese sector.",
                  "DescripcionProblema": "Comunidades Rurales y Pymes: Productores que enfrentan cuellos de botella críticos en conocimiento, pero carecen de presupuesto para consultorías o de alfabetización digital para acceder a soluciones tecnológicas, lo viven constantemente.   Estudiantes y Profesores: Universitarios que se forman con casos teóricos obsoletos en lugar de impacto real; y docentes asfixiados por la fricción burocrática manual (correos, actas, llamadas) que exige coordinar un solo proyecto con el entorno.  Grandes Empresas: Organizaciones con capital de propósito (presupuestos ESG) y vacantes de empleo que no encuentran canales transparentes para invertir en territorio ni logran hacer un reclutamiento (\"scouting\") basado en el desempeño real.  Universidades: Que presentan desconexión con  sus estudiantes al no tener retos reales que brindarles en nuevos modelos educativos mas exigentes.",
                  "ValidacionProblema": "Revisé literatura académica y reportes sectoriales que describen el problema.;Hice entrevistas informales con personas que podrían ser usuarios o clientes. ;",
                  "PersonasEntrevistadas": "Entre 1 y 5 personas.",
                  "ResultadoConversaciones": "Ajustamos la propuesta de valor (lo que ofrecemos o cómo lo presentamos).",
                  "TipoClientePrincipal": "Empresas o negocios (Vendes a empresas, emprendimientos o negocios)-B2B.;",
                  "EvidenciaInteresSolucion": "Personas me han dicho verbalmente que les parece buena idea. ;",
                  "EvidenciaInteresOtro": "",
                  "ConocimientoCompetencia": "He hecho un análisis comparativo formal (benchmark",
                  "EstimacionMercado": "Tengo una idea general, pero sin números respaldados por fuentes.",
                  "AlcanceGeografico": "Varios países (internacional).",
                  "PropuestaValor": "Para universidades, profesores, comunidades y pymes aisladas de la innovación, Polen HUB es un marketplace con IA que automatiza la conversión e integración de retos reales directamente en el Syllabus académico, resolviendo cuellos de botella de bioeconomía y logística mientras acelera la empleabilidad de estudiantes con micro-credenciales Blockchain financiadas por patrocinio empresarial.",
                  "ClaridadValor": "La tengo estructurada",
                  "DiferenciaCompetencia": "Nuestra comunidad o red de usuarios fortalece el crecimiento de la iniciativa.;Tenemos una marca o posicionamiento temprano en el mercado.;Contamos con know-how o conocimiento especializado difícil de replicar.;",
                  "SectorProductivo": "Inteligencia artificial y computación avanzada;Tecnologías de la información y comunicación (TIC);Economía digital (plataformas, comercio electrónico, fintech);",
                  "ModeloIngresos": "Combinación de varios de los anteriores.",
                  "Canales": "Plataforma digital o e-commerce propio.",
                  "AliadosEstrategicos": "Estoy en conversaciones informales con posibles aliados.",
                  "TieneVentas": "No",
                  "FacturacionTotal": "",
                  "PromedioVentasMensual3M": "",
                  "PuntoEquilibrio": "",
                  "RegistrosContablesDisponibles": "",
                  "EstadoProteccionPI": "Todavía no he pensado en proteger la PI.",
                  "TipoProteccionPI": "Registro de software.",
                  "DuenoLegalPI": "Todavía no está definida la titularidad.",
                  "LibertadOperacion": "He hecho una revisión informal (búsquedas rápidas en Google o bases de datos).",
                  "RolesEquipoCubiertos": "Investigador principal con dominio técnico-científico. ;Responsable de negocio o desarrollo comercial (alguien que piensa en cliente, ventas, modelo). ;Co-investigador técnico que complementa al principal. ;Responsable de producto, UX o ingeniería aplicada.   TMRL;",
                  "ExperienciaEmprendimientoTransferencia": "Alguien creó y operó una empresa exitosa.",
                  "DedicacionEquipo": "Más de 20 horas por semana.",
                  "DisponibilidadTiempoCompleto": "Sí, hay al menos una persona comprometida a hacerlo.",
                  "MujeresEquipo": "0",
                  "BonoEquidadAplica": false,
                  "JustificacionEquipoMercado": "Combinamos mi experiencia real operando marketplace de MercadoLibre y aplicando modelos de negocio con IA, junto con la trayectoria de Johan como profesor investigador y empresario en la Ean, uniendo  la velocidad técnica del mercado con las reglas y la gobernanza de la universidad, hemos vivido desde profesores la necesidad de los retos para los alumnos y el despilfarro de inteligencia universitaria que tenemos a hoy..",
                  "InversionAcumulada": "Menos de 10 millones de COP.",
                  "FuentesInversion": "Recursos propios del equipo o familia (FFF). ;",
                  "NecesidadFinanciera12Meses": "Entre 20 y 70 millones.",
                  "RecursosOperacion6Meses": "Parcialmente (cubro menos del 50% de lo que necesito).",
                  "BuscaInversion": "Sí, estamos en etapa de preparación (deck, proyecciones, pitch).",
                  "EstadoLegal": "Todavía no he pensado en constituir empresa.",
                  "VerticalSostenibilidad": "EdTech.;Educación inclusiva para el futuro. ;",
                  "ODSRelacionados": "ODS 4: Educación de calidad;ODS 11: Ciudades y comunidades sostenibles;ODS 8: Trabajo decente y crecimiento económico;",
                  "MideImpacto": "Tenemos métricas cualitativas generales (sin números).",
                  "RequiereRegulacion": "No requiere autorizaciones específicas. ;",
                  "EstadoTramitesRegulatorios": "No aplica (no requiere autorizaciones).",
                  "VideoPitchURL": "https://example.com/s2v-2026-001/video-pitch",
                  "URLAnexo1": "https://example.com/s2v-2026-001/anexo1",
                  "RetoPrograma": "Inversión para el desarrollo tecnológico y apoyo con la Universidad para aprobar la conexión a los Syllabus.",
                  "EstadoPostulacion": "Recibida",
                  "CoherenciaTRLPreliminar": "Pendiente de revisión"
            },
            {
                  "IDOriginal": "3",
                  "IDIniciativa": "S2V-2026-002",
                  "NombreIniciativa": "Click Agents",
                  "NombreLider": "juan sebastian camacho falla",
                  "CorreoLider": "j***o@gmail.com",
                  "Ciudad": "bogotá",
                  "VinculacionLider": "Estudiante",
                  "FacultadArea": "",
                  "RolIniciativa": "SEO",
                  "SurgeGrupoSemillero": "No",
                  "GrupoOSemillero": "",
                  "AreaConocimiento": "Ingeniería y tecnología",
                  "EnfoqueProyecto": "Base tecnológica",
                  "DescripcionCorta": "Click Agents es una plataforma SaaS de IA conversacional que permite a las PYMEs de LATAM atender llamadas, WhatsApp, Instagram y Messenger de forma automática, 24/7 y en español. Resuelve un problema clave: los pequeños negocios pierden entre 30% y 40% de sus clientes potenciales por no poder responder a tiempo, y contratar personal cuesta $400-800 USD/mes. Nuestro agente de IA se configura en menos de 10 minutos, responde en segundos, agenda citas y captura leads desde $99 USD/mes. El impacto: democratizamos el acceso a tecnología que antes solo tenían las grandes empresas, ayudando a más de 30 millones de PYMEs a recuperar ventas y competir en igualdad de condiciones.",
                  "PosturaEquityEan": "Si estoy de acuerdo con que la Universidad tenga participación.",
                  "AnioInicioTecnologia": "2026",
                  "TRLDeclarado": "TRL 7 Prototipo en entorno de operación",
                  "TRLNum": 7,
                  "RutaTRL": "TRL 7-9",
                  "CRLDeclarado": "CRL 6 Optimización de productos/soluciones",
                  "CRLNum": 6,
                  "BRLDeclarado": "BRL 6 Producto mínimo viable",
                  "BRLNum": 6,
                  "EvidenciasTRL": "Ponencia o presentación en evento científico o tecnológico. ;Prototipo físico o digital con fotos o videos que lo muestren funcionando. ;Software funcional con repositorio público (GitHub, GitLab, Zenodo). ;",
                  "EntornoPruebaTecnologia": "En operación real continuada, con usuarios o clientes que la usan regularmente.",
                  "BrechaTecnicaPrincipal": "Integrar nuestra solución con los sistemas o infraestructura que ya tiene un cliente real.",
                  "TipoTecnologia": "Estoy creando tecnología propia como producto principal (software, IA entrenada, SaaS, API, hardware).",
                  "OrigenTecnologia": "Una parte la desarrollamos internamente; otra parte se apoya en herramientas existentes.",
                  "ComplejidadTecnica": "Alto",
                  "EvidenciasDocumentadas": "Estoy preparando la documentación, pero aún no cuento con soportes listos para revisión.",
                  "EvidenciasURL": "",
                  "OrigenProblema": "Un cliente, empresa o entidad específica nos trajo el problema y nos pidió una solución.",
                  "DescripcionProblema": "El problema lo viven los dueños de pequeños y medianos negocios en LATAM (restaurantes, clínicas, inmobiliarias, empresas, consultorios) que están al frente de su operación diaria y no pueden estar en dos lugares a la vez. Mientras atienden a un cliente en persona, el teléfono suena, entran mensajes de WhatsApp e Instagram, y muchas de esas consultas llegan fuera del horario laboral o en fines de semana. Esto ocurre todos los días y a toda hora: el pico de llamadas suele coincidir con el momento de mayor carga operativa, y una parte importante de los mensajes llega cuando el negocio está cerrado. No es un evento aislado, es una fuga constante. Las consecuencias son directas y medibles: estos negocios pierden entre el 30% y el 40% de sus oportunidades comerciales porque cada llamada no contestada y cada mensaje sin responder es un cliente que se va a la competencia. La solución tradicional, contratar un recepcionista, cuesta entre $400 y $800 USD al mes, algo inviable para la mayoría de las PYMEs. El resultado es una pérdida silenciosa de ingresos que limita el crecimiento de millones de negocios que sí tienen demanda pero no la capacidad operativa de capturarla.",
                  "ValidacionProblema": "Hice pruebas piloto con la solución real (aunque sea versión básica) con usuarios. ;Tengo estudios previos propios o de terceros que respaldan la existencia del problema. ;Un cliente o aliado está pagando o pilotando la solución hoy.;",
                  "PersonasEntrevistadas": "Más de 30 personas.",
                  "ResultadoConversaciones": "Ajustamos la propuesta de valor (lo que ofrecemos o cómo lo presentamos).",
                  "TipoClientePrincipal": "Empresas o negocios (Vendes a empresas, emprendimientos o negocios)-B2B.;",
                  "EvidenciaInteresSolucion": "Personas me han dicho verbalmente que les parece buena idea. ;Hay pilotos no pagados en curso o ya completados. ;",
                  "EvidenciaInteresOtro": "",
                  "ConocimientoCompetencia": "He hecho un análisis comparativo formal (benchmark",
                  "EstimacionMercado": "He calculado TAM, SAM y SOM con fuentes y supuestos documentados.",
                  "AlcanceGeografico": "Varios países (internacional).",
                  "PropuestaValor": "Click Agents es la plataforma de IA conversacional para los pequeños y medianos negocios de LATAM que pierden clientes por no poder atender todas sus llamadas y mensajes a tiempo. A diferencia de las soluciones globales, ofrece atención automática 24/7 por voz y mensajería en español latino nativo, se configura en 10 minutos sin conocimientos técnicos y cuesta desde $99 USD/mes en lugar de los $500+ de Intercom o Drift. La diferenciación que estoy destacando es el trío precio + español nativo + multicanal con setup inmediato, que es lo más concreto y verificable de tu documento. Si quieres apostar por un solo diferenciador más fuerte (por ejemplo \"IA generativa real vs chatbot rígido\"), dime y lo reescribo con ese ángulo.",
                  "ClaridadValor": "Está estructurada, validada y ajustada varias veces con base en lo aprendido del mercado.",
                  "DiferenciaCompetencia": "Contamos con know-how o conocimiento especializado difícil de replicar.;Ofrecemos una alternativa con costos más eficientes.;Tenemos una marca o posicionamiento temprano en el mercado.;",
                  "SectorProductivo": "Tecnologías de la información y comunicación (TIC);Inteligencia artificial y computación avanzada;",
                  "ModeloIngresos": "Combinación de varios de los anteriores.",
                  "Canales": "Venta directa por parte del equipo fundador (nosotros mismos vendemos).",
                  "AliadosEstrategicos": "Todavía no tengo aliados formales.",
                  "TieneVentas": "Sí",
                  "FacturacionTotal": "$750.000",
                  "PromedioVentasMensual3M": "llevamos un mes operando con 2 clientes",
                  "PuntoEquilibrio": "Sí, alcanzamos el punto de equilibrio recientemente.",
                  "RegistrosContablesDisponibles": "Llevamos registros contables formales, pero los hacemos nosotros mismos.",
                  "EstadoProteccionPI": "He hecho un análisis preliminar pero no tenemos protección formal aún.",
                  "TipoProteccionPI": "Registro de software.",
                  "DuenoLegalPI": "Todavía no está definida la titularidad.",
                  "LibertadOperacion": "He hecho una revisión informal (búsquedas rápidas en Google o bases de datos).",
                  "RolesEquipoCubiertos": "Responsable de negocio o desarrollo comercial (alguien que piensa en cliente, ventas, modelo). ;",
                  "ExperienciaEmprendimientoTransferencia": "Alguien participó en programas formativos de emprendimiento (cursos, bootcamps).",
                  "DedicacionEquipo": "Tiempo completo.",
                  "DisponibilidadTiempoCompleto": "Ya hay alguien dedicado tiempo completo al proyecto hoy.",
                  "MujeresEquipo": "1",
                  "BonoEquidadAplica": true,
                  "JustificacionEquipoMercado": "Soy la persona indicada para llevar Click Agents al mercado porque combino las dos capacidades que este negocio exige y que rara vez coexisten: construcción técnica y desarrollo comercial. Diseñé y construí la plataforma end-to-end, integrando un stack complejo de IA conversacional (Claude, Retell, Meta API, Twilio, Cal.com) afinado para el español latino y las PYMEs de LATAM, y hoy es un producto funcional en producción. A la vez, mi experiencia está en estrategia comercial, marketing y adquisición de clientes, que es justo el reto actual del proyecto: convertir un producto validado en un negocio con clientes pagantes. Conozco el problema desde dentro porque vengo del ecosistema de PYMEs en Colombia, y trabajo con validación iterativa: pruebo hipótesis con casos reales, como el piloto del Restaurante Los Lagos, antes de escalar.",
                  "InversionAcumulada": "Menos de 10 millones de COP.",
                  "FuentesInversion": "Recursos propios del equipo o familia (FFF). ;",
                  "NecesidadFinanciera12Meses": "Entre 20 y 70 millones.",
                  "RecursosOperacion6Meses": "Sí, pero ajustado (entre 50% y 80%).",
                  "BuscaInversion": "Sí, estamos en etapa de preparación (deck, proyecciones, pitch).",
                  "EstadoLegal": "Estoy evaluando qué figura jurídica sería la adecuada (SAS, Ltda, etc.).",
                  "VerticalSostenibilidad": "IA y Tecnologías Emergentes. ;",
                  "ODSRelacionados": "ODS 8: Trabajo decente y crecimiento económico;ODS 9: Industria, innovación e infraestructura;ODS 10: Reducción de las desigualdades;",
                  "MideImpacto": "Todavía no hemos definido métricas de impacto.",
                  "RequiereRegulacion": "No requiere autorizaciones específicas. ;",
                  "EstadoTramitesRegulatorios": "No aplica (no requiere autorizaciones).",
                  "VideoPitchURL": "https://example.com/s2v-2026-002/video-pitch",
                  "URLAnexo1": "https://example.com/s2v-2026-002/anexo1",
                  "RetoPrograma": "El obstáculo más urgente es pasar de un producto técnicamente validado a un negocio con clientes pagantes recurrentes. Click Agents ya está en producción y funciona de punta a punta, con un primer caso de uso real operando; el reto ya no es construir, sino vender y escalar. Específicamente quiero resolver tres cosas con el acompañamiento: (1) afinar un modelo de adquisición de clientes que sea repetible y rentable para llegar a los primeros 10-20 negocios pagantes; (2) validar el pricing y el empaquetamiento de los planes con criterios de mercado, no de intuición; y (3) acceder a una red de mentores que ya hayan escalado un SaaS B2B en LATAM y a contactos que aceleren la llegada a esos primeros clientes. Mi mayor brecha hoy es comercial y de red, no tecnológica, y es justo donde un programa como Science2Venture puede multiplicar lo que ya tengo en marcha.",
                  "EstadoPostulacion": "Recibida",
                  "CoherenciaTRLPreliminar": "Pendiente de revisión"
            },
            {
                  "IDOriginal": "4",
                  "IDIniciativa": "S2V-2026-003",
                  "NombreIniciativa": "Munay",
                  "NombreLider": "Juan Manuel Rojas Guerrero",
                  "CorreoLider": "j***g@outlook.com",
                  "Ciudad": "Bogotá",
                  "VinculacionLider": "Estudiante",
                  "FacultadArea": "",
                  "RolIniciativa": "Desarrollador",
                  "SurgeGrupoSemillero": "No",
                  "GrupoOSemillero": "",
                  "AreaConocimiento": "Ingeniería y tecnología",
                  "EnfoqueProyecto": "Base tecnológica",
                  "DescripcionCorta": "Munay desarrolla una solución tecnológica para capturar, medir y gestionar CO₂ directamente en vehículos de combustión interna, especialmente en flotas empresariales. Resuelve el problema de las emisiones móviles difíciles de mitigar, ofreciendo a las empresas una alternativa práctica para avanzar en descarbonización sin reemplazar de inmediato sus activos vehiculares. Su impacto es ambiental, al reducir y monitorear emisiones; económico, al habilitar nuevos modelos de eficiencia y potencial valorización del CO₂ capturado; y científico-tecnológico, al transferir investigación aplicada hacia una solución escalable.",
                  "PosturaEquityEan": "Si estoy de acuerdo con que la Universidad tenga participación.",
                  "AnioInicioTecnologia": "2025",
                  "TRLDeclarado": "TRL 2 Concepto de tecnología formulado",
                  "TRLNum": 2,
                  "RutaTRL": "TRL 1-3",
                  "CRLDeclarado": "CRL 2 Conocimiento del mercado",
                  "CRLNum": 2,
                  "BRLDeclarado": "BRL 4 Definición de cliente",
                  "BRLNum": 4,
                  "EvidenciasTRL": "Tesis de pregrado, maestría o doctorado vinculada al proyecto. ;",
                  "EntornoPruebaTecnologia": "Todavía no la he probado físicamente (solo en papel, modelado o simulación).",
                  "BrechaTecnicaPrincipal": "Construir el primer prototipo integrado (combinar los componentes en un solo sistema).",
                  "TipoTecnologia": "Mi proyecto es Deep Tech",
                  "OrigenTecnologia": "Combinamos varias tecnologías existentes para crear algo nuevo que antes no existía así.",
                  "ComplejidadTecnica": "Muy alto (Deep Tech)",
                  "EvidenciasDocumentadas": "No cuento todavía con evidencias documentadas del avance técnico.",
                  "EvidenciasURL": "",
                  "OrigenProblema": "Identificamos el problema leyendo literatura académica, reportes del sector o noticias.",
                  "DescripcionProblema": "El problema que resuelve Munay es la dificultad que tienen las empresas con flotas de vehículos de combustión interna para reducir y demostrar la gestión de sus emisiones de CO₂. Este problema lo viven principalmente operadores logísticos, empresas de transporte, organizaciones con flotas propias y compañías que dependen de vehículos diésel o gasolina para su operación diaria. Es un problema permanente, porque las emisiones se generan cada vez que los vehículos están en circulación. En muchos casos, las empresas no pueden reemplazar su flota en el corto plazo por razones económicas, operativas o de infraestructura, lo que limita sus posibilidades reales de avanzar en descarbonización. Las consecuencias son ambientales, por el aporte continuo de gases de efecto invernadero; económicas, por la exposición a futuras exigencias regulatorias, costos de compensación o pérdida de competitividad; y reputacionales, porque cada vez más clientes, inversionistas y cadenas de valor exigen evidencia verificable de gestión climática. Munay aborda este problema ofreciendo una alternativa tecnológica para capturar, medir y gestionar CO₂ directamente desde la fuente móvil.",
                  "ValidacionProblema": "Revisé literatura académica y reportes sectoriales que describen el problema.;Tengo estudios previos propios o de terceros que respaldan la existencia del problema. ;",
                  "PersonasEntrevistadas": "Entre 1 y 5 personas.",
                  "ResultadoConversaciones": "Ajustamos la propuesta de valor (lo que ofrecemos o cómo lo presentamos).",
                  "TipoClientePrincipal": "Empresas o negocios (Vendes a empresas, emprendimientos o negocios)-B2B.;",
                  "EvidenciaInteresSolucion": "Personas me han dicho verbalmente que les parece buena idea. ;",
                  "EvidenciaInteresOtro": "",
                  "ConocimientoCompetencia": "He identificado algunas soluciones alternativas o sustitutas.",
                  "EstimacionMercado": "He calculado TAM, SAM y SOM con fuentes y supuestos documentados.",
                  "AlcanceGeografico": "Todo el territorio nacional.",
                  "PropuestaValor": "Munay es una solución tecnológica para empresas con flotas de vehículos de combustión interna que necesitan reducir y demostrar la gestión de sus emisiones de CO₂ sin sustituir de inmediato sus activos vehiculares. A diferencia de las compensaciones tradicionales, Munay actúa directamente sobre la fuente móvil mediante captura, medición y gestión del CO₂, integrando tecnología aplicada, trazabilidad MRV y un modelo escalable orientado a descarbonización real.",
                  "ClaridadValor": "La tengo estructurada",
                  "DiferenciaCompetencia": "Ofrecemos una alternativa con costos más eficientes.;",
                  "SectorProductivo": "Economía verde y circular (sostenibilidad, reciclaje, carbono neutro);",
                  "ModeloIngresos": "Combinación de varios de los anteriores.",
                  "Canales": "Equipo comercial propio (personas contratadas para vender).",
                  "AliadosEstrategicos": "Todavía no tengo aliados formales.",
                  "TieneVentas": "No",
                  "FacturacionTotal": "",
                  "PromedioVentasMensual3M": "",
                  "PuntoEquilibrio": "",
                  "RegistrosContablesDisponibles": "",
                  "EstadoProteccionPI": "He hecho un análisis preliminar pero no tenemos protección formal aún.",
                  "TipoProteccionPI": "Diseño industrial.",
                  "DuenoLegalPI": "Todavía no está definida la titularidad.",
                  "LibertadOperacion": "He hecho un análisis preliminar con búsqueda básica en bases de patentes.",
                  "RolesEquipoCubiertos": "Responsable de negocio o desarrollo comercial (alguien que piensa en cliente, ventas, modelo). ;",
                  "ExperienciaEmprendimientoTransferencia": "Ninguno tiene experiencia previa.",
                  "DedicacionEquipo": "Entre 9 y 12 horas por semana.",
                  "DisponibilidadTiempoCompleto": "Sí, hay al menos una persona comprometida a hacerlo.",
                  "MujeresEquipo": "0",
                  "BonoEquidadAplica": false,
                  "JustificacionEquipoMercado": "Actualmente Munay es un proyecto liderado por mí como fundador unipersonal. Soy la persona indicada para llevar esta tecnología al mercado porque mi perfil combina gestión de proyectos, tecnología para el impacto social, sostenibilidad, regeneración e inclusión digital, lo que me permite conectar el desarrollo técnico con una visión clara de mercado, impacto y escalabilidad. Además, Munay ya ha demostrado capacidad de validación y reconocimiento en escenarios de innovación universitaria: obtuvo el segundo lugar en EnsambleU como solución de captura, almacenamiento y valorización de CO₂ generado por vehículos de combustión. Mi fortaleza no está en partir con un equipo amplio, sino en tener la capacidad de estructurar el proyecto, gestionar aliados técnicos, articular capacidades académicas y empresariales, y convertir una investigación aplicada en una solución transferible al mercado. Munay nace desde una necesidad real de descarbonización en flotas vehiculares y mi rol es liderar su evolución con rigor técnico, propósito ambiental y viabilidad comercial.",
                  "InversionAcumulada": "Menos de 10 millones de COP.",
                  "FuentesInversion": "Recursos propios del equipo o familia (FFF). ;",
                  "NecesidadFinanciera12Meses": "Entre 20 y 70 millones.",
                  "RecursosOperacion6Meses": "Parcialmente (cubro menos del 50% de lo que necesito).",
                  "BuscaInversion": "No, por ahora no es una prioridad.",
                  "EstadoLegal": "Estoy evaluando qué figura jurídica sería la adecuada (SAS, Ltda, etc.).",
                  "VerticalSostenibilidad": "DeepTech. ;Economía circular.;",
                  "ODSRelacionados": "ODS 9: Industria, innovación e infraestructura;ODS 11: Ciudades y comunidades sostenibles;ODS 13: Acción por el clima ;",
                  "MideImpacto": "Tenemos métricas cuantificables propuestas, pero aún no las medimos.",
                  "RequiereRegulacion": "No requiere autorizaciones específicas. ;",
                  "EstadoTramitesRegulatorios": "No aplica (no requiere autorizaciones).",
                  "VideoPitchURL": "https://example.com/s2v-2026-003/video-pitch",
                  "URLAnexo1": "https://example.com/s2v-2026-003/anexo1",
                  "RetoPrograma": "El principal reto que quiero resolver en el programa es avanzar en la validación técnica y estructuración del prototipo funcional de Munay. Aunque el proyecto ya cuenta con una propuesta tecnológica, modelo de negocio preliminar y análisis de impacto, la siguiente etapa crítica es llevar el concepto a una arquitectura técnica validable, con especificaciones claras de diseño, componentes, desempeño esperado, condiciones de operación y criterios de medición. Busco que el programa me ayude a definir una ruta concreta de prototipado que permita evaluar la viabilidad del sistema de captura, almacenamiento, medición y gestión de CO₂ en un entorno controlado, antes de avanzar hacia pruebas en vehículos reales. Esto incluye validar supuestos técnicos, identificar riesgos de integración vehicular, establecer métricas de eficiencia y seguridad, y estructurar una hoja de ruta que acerque a Munay a una tecnología lista para transferencia, pilotaje.",
                  "EstadoPostulacion": "Recibida",
                  "CoherenciaTRLPreliminar": "Pendiente de revisión"
            },
            {
                  "IDOriginal": "5",
                  "IDIniciativa": "S2V-2026-004",
                  "NombreIniciativa": "EANMOB: Plataforma Inteligente de Movilidad Corporativa Compartida",
                  "NombreLider": "Leonardo Andres Perez Cortes",
                  "CorreoLider": "l***z@universidadean.edu.co",
                  "Ciudad": "Bogota / Bogota DC",
                  "VinculacionLider": "Profesor / Investigador",
                  "FacultadArea": "Facultad de Ingeniería",
                  "RolIniciativa": "Director y creador del proyecto",
                  "SurgeGrupoSemillero": "Sí, de un semillero",
                  "GrupoOSemillero": "Grupo de investigacion INDEVOS, Semillero CHISPA",
                  "AreaConocimiento": "Ingeniería y tecnología",
                  "EnfoqueProyecto": "Base tecnológica",
                  "DescripcionCorta": "Imagina que mañana vas al trabajo y, en lugar de salir solo en tu carro, un vecino que trabaja en tu misma empresa te acompaña y comparte los gastos. Eso es EANMOB. EANMOB es una app móvil que conecta empleados de la misma empresa que viven cerca y van al mismo destino, para que compartan el viaje. El pasajero paga una tarifa mucho más baja por el trayecto comparado con un Uber o un taxi, y viaja con alguien de confianza. El conductor recibe un pago por el recorrido que ya iba a hacer de todas formas. La empresa reduce su huella de carbono, lo que se traduce en menos impuestos, y libera espacios de parqueadero. Y todos ganan un beneficio extra: tokens canjeables por días de trabajo en casa o descuentos en la cafetería. Menos carros, menos contaminación, y el camino al trabajo convertido en una buena conversación.",
                  "PosturaEquityEan": "Si estoy de acuerdo con que la Universidad tenga participación.",
                  "AnioInicioTecnologia": "2026",
                  "TRLDeclarado": "TRL 4 Prueba experimental de concepto",
                  "TRLNum": 4,
                  "RutaTRL": "TRL 4-6",
                  "CRLDeclarado": "CRL 5 Alineación del mercado",
                  "CRLNum": 5,
                  "BRLDeclarado": "BRL 5 Prueba de hipótesis",
                  "BRLNum": 5,
                  "EvidenciasTRL": "Ponencia o presentación en evento científico o tecnológico. ;Software funcional con repositorio público (GitHub, GitLab, Zenodo). ;Reporte técnico interno con resultados experimentales documentados.",
                  "EntornoPruebaTecnologia": "Todavía no la he probado físicamente (solo en papel, modelado o simulación).",
                  "BrechaTecnicaPrincipal": "Construir el primer prototipo integrado (combinar los componentes en un solo sistema).",
                  "TipoTecnologia": "Estoy creando tecnología propia como producto principal (software, IA entrenada, SaaS, API, hardware).",
                  "OrigenTecnologia": "Una parte la desarrollamos internamente; otra parte se apoya en herramientas existentes.",
                  "ComplejidadTecnica": "Alto",
                  "EvidenciasDocumentadas": "Sí, cuento con evidencias documentadas que pueden ser revisadas en esta convocatoria.",
                  "EvidenciasURL": "https://example.com/s2v-2026-004/evidencias",
                  "OrigenProblema": "Identificamos el problema leyendo literatura académica, reportes del sector o noticias.",
                  "DescripcionProblema": "Cada mañana en Bogotá, miles de empleados salen solos en su carro hacia la misma empresa, a la misma hora, sin saber que un colega vive a tres cuadras y hace exactamente el mismo recorrido. Lo descubrí con mis propios estudiantes en la Universidad Ean: unos llegaban agotados después de horas en el trancón, otros llegaban habiendo gastado en Uber o DiDi un dinero que no podían pagar todos los días. Ninguno sabía que podría haber compartido el viaje con alguien de confianza. El resultado es un problema triple: parqueaderos colapsados, dinero desperdiciado en transporte innecesariamente individual, y una huella de carbono que como sociedad tenemos el deber urgente de reducir. Hoy ninguna empresa puede demostrar porque el dato del commute de sus empleados simplemente no existe. EANMOB resuelve los tres: conecta colegas verificados para compartir el viaje, reduce el costo diario del transporte, y genera automáticamente los datos de emisiones que empresas y reguladores necesitan ver.",
                  "ValidacionProblema": "Revisé literatura académica y reportes sectoriales que describen el problema.;Hice entrevistas informales con personas que podrían ser usuarios o clientes. ;Tengo estudios previos propios o de terceros que respaldan la existencia del problema.",
                  "PersonasEntrevistadas": "Entre 6 y 15 personas.",
                  "ResultadoConversaciones": "Ajustamos la propuesta de valor (lo que ofrecemos o cómo lo presentamos).",
                  "TipoClientePrincipal": "Empresas o negocios (Vendes a empresas, emprendimientos o negocios)-B2B.;Conectas personas para que se vendan entre ellas (Tu negocio no vende directamente, sino que permite que otras personas compren y vendan entre sí)-C2C.",
                  "EvidenciaInteresSolucion": "Personas me han dicho verbalmente que les parece buena idea. ;Otro",
                  "EvidenciaInteresOtro": "El equipo ha sostenido reuniones con representantes de empresas que han manifestado interés directo en la solución, evidenciadas con registro fotográfico.",
                  "ConocimientoCompetencia": "He mapeado a mis competidores directos y sé qué ofrecen.",
                  "EstimacionMercado": "He calculado TAM y SAM con fuentes citables.",
                  "AlcanceGeografico": "Principales ciudades de Colombia.",
                  "PropuestaValor": "Para empresas, parques industriales y universidades en Bogotá que enfrentan parqueaderos saturados, altos costos de transporte para sus empleados y la presión de reducir su huella de carbono — EANMOB conecta colegas de la misma organización para compartir el viaje al trabajo, entregando datos reales de emisiones reducidas para sus reportes de sostenibilidad. A diferencia de Uber o DiDi, cada viaje ocurre entre compañeros verificados por la misma organización — no entre desconocidos.",
                  "ClaridadValor": "Está estructurada y la he validado con al menos 5 clientes potenciales.",
                  "DiferenciaCompetencia": "Contamos con know-how o conocimiento especializado difícil de replicar.;Tenemos acceso a datos propios o información diferenciadora.;Nuestra comunidad o red de usuarios fortalece el crecimiento de la iniciativa.",
                  "SectorProductivo": "Tecnologías de la información y comunicación (TIC);Economía digital (plataformas, comercio electrónico, fintech);Economía verde y circular (sostenibilidad, reciclaje, carbono neutro)",
                  "ModeloIngresos": "Combinación de varios de los anteriores.",
                  "Canales": "Alianzas con empresas que integran nuestra solución dentro de la suya.",
                  "AliadosEstrategicos": "Estoy en conversaciones informales con posibles aliados.",
                  "TieneVentas": "No",
                  "FacturacionTotal": "",
                  "PromedioVentasMensual3M": "",
                  "PuntoEquilibrio": "",
                  "RegistrosContablesDisponibles": "",
                  "EstadoProteccionPI": "Todavía no he pensado en proteger la PI.",
                  "TipoProteccionPI": "Todavía no aplicamos ninguno.",
                  "DuenoLegalPI": "Todavía no está definida la titularidad.",
                  "LibertadOperacion": "No he considerado ese tema.",
                  "RolesEquipoCubiertos": "Investigador principal con dominio técnico-científico. ;Responsable de producto, UX o ingeniería aplicada.   TMRL",
                  "ExperienciaEmprendimientoTransferencia": "Ninguno tiene experiencia previa.",
                  "DedicacionEquipo": "Menos de 5 horas por semana.",
                  "DisponibilidadTiempoCompleto": "Sí, hay al menos una persona comprometida a hacerlo.",
                  "MujeresEquipo": "3",
                  "BonoEquidadAplica": true,
                  "JustificacionEquipoMercado": "El actual equipo EANMOB aporta conocimiento en desarrollo de software, algoritmos y construcción de plataformas web, entre otros.  Sabemos lo que nos falta y lo declaramos con claridad: necesitamos perfiles con experiencia en integración de pagos online, medición de huella de carbono, y un equipo comercial, de mercadeo y finanzas. Completar ese equipo es uno de los objetivos centrales del acompañamiento que buscamos.",
                  "InversionAcumulada": "Entre 10 y 50 millones.",
                  "FuentesInversion": "Recursos propios del equipo o familia (FFF).",
                  "NecesidadFinanciera12Meses": "Entre 20 y 70 millones.",
                  "RecursosOperacion6Meses": "Parcialmente (cubro menos del 50% de lo que necesito).",
                  "BuscaInversion": "Sí, estamos en etapa de preparación (deck, proyecciones, pitch).",
                  "EstadoLegal": "Estoy evaluando qué figura jurídica sería la adecuada (SAS, Ltda, etc.).",
                  "VerticalSostenibilidad": "IA y Tecnologías Emergentes. ;Ciudades inteligentes y sostenibles.",
                  "ODSRelacionados": "ODS 13: Acción por el clima ;ODS 8: Trabajo decente y crecimiento económico;ODS 11: Ciudades y comunidades sostenibles",
                  "MideImpacto": "Tenemos métricas cualitativas generales (sin números).",
                  "RequiereRegulacion": "Otro regulador sectorial.",
                  "EstadoTramitesRegulatorios": "No hemos iniciado los trámites.",
                  "VideoPitchURL": "https://example.com/s2v-2026-004/video-pitch",
                  "URLAnexo1": "https://example.com/s2v-2026-004/anexo1",
                  "RetoPrograma": "Nuestro reto principal es convertir una base técnica sólida en un producto terminado y listo para el mercado. Tenemos arquitectura, motor de matching que falta validarlo y algunos diseños UX pero los componentes no están integrados en un flujo completo, es deir queremos ingenieros que nos den una mano para desarrollar la propuesta de forma profesional y rapidamente. Paralelamente tenemos cuatro brechas que no podemos cerrar solos: producto terminado, PI protegida, spin-off constituida y equipo comercial formado. Science2Venture es el programa que nos permite resolverlas al mismo tiempo.",
                  "EstadoPostulacion": "Recibida",
                  "CoherenciaTRLPreliminar": "Pendiente de revisión"
            },
            {
                  "IDOriginal": "6",
                  "IDIniciativa": "S2V-2026-005",
                  "NombreIniciativa": "FLUXEO ENERGY",
                  "NombreLider": "Sebastian Andres Medina Raigoza",
                  "CorreoLider": "s***a@gmail.com",
                  "Ciudad": "Bogotá",
                  "VinculacionLider": "Graduado",
                  "FacultadArea": "",
                  "RolIniciativa": "Investigador principal, Capacidad para liderar el análisis de mercado y la estructuración del modelo de negocio.",
                  "SurgeGrupoSemillero": "No",
                  "GrupoOSemillero": "",
                  "AreaConocimiento": "Ingeniería y tecnología",
                  "EnfoqueProyecto": "Digital",
                  "DescripcionCorta": "Responsable de comunicación, relacionamiento con el ecosistema y del desarrollo de software para el despliegue de la solución tecnológica.",
                  "PosturaEquityEan": "Si estoy de acuerdo con que la Universidad tenga participación.",
                  "AnioInicioTecnologia": "2026",
                  "TRLDeclarado": "TRL 7 Prototipo en entorno de operación",
                  "TRLNum": 7,
                  "RutaTRL": "TRL 7-9",
                  "CRLDeclarado": "CRL 7 Validación del modelo financiero",
                  "CRLNum": 7,
                  "BRLDeclarado": "BRL 6 Producto mínimo viable",
                  "BRLNum": 6,
                  "EvidenciasTRL": "Prototipo físico o digital con fotos o videos que lo muestren funcionando. ;Dataset (base de datos) propio generado por el proyecto.",
                  "EntornoPruebaTecnologia": "En entorno simulado que reproduce condiciones reales (pruebas de campo controladas).",
                  "BrechaTecnicaPrincipal": "Integrar nuestra solución con los sistemas o infraestructura que ya tiene un cliente real.",
                  "TipoTecnologia": "Estoy creando tecnología propia como producto principal (software, IA entrenada, SaaS, API, hardware).",
                  "OrigenTecnologia": "Una parte la desarrollamos internamente; otra parte se apoya en herramientas existentes.",
                  "ComplejidadTecnica": "Alto",
                  "EvidenciasDocumentadas": "Sí, cuento con evidencias documentadas que pueden ser revisadas en esta convocatoria.",
                  "EvidenciasURL": "https://example.com/s2v-2026-005/evidencias",
                  "OrigenProblema": "Identificamos el problema por experiencia directa de alguien del equipo en ese sector.",
                  "DescripcionProblema": "Los desafíos de la movilidad eléctrica no solo están en la instalación de cargadores, sino en la integración tecnológica y operativa de toda la infraestructura. Muchas empresas enfrentan un ecosistema fragmentado donde cargadores, plataformas CMS y softwares de gestión no se comunican correctamente, generando incompatibilidades, fallas operativas y dificultades para centralizar el monitoreo, control y facturación de las estaciones. A esto se suman falta de soporte técnico especializado para integrar estas soluciones a la infraestructura eléctrica existente. El resultado son proyectos con retrasos, activos detenidos y redes de carga que no logran operar de manera confiable ni escalable. Muchas empresas terminan realizando la inversión, pero sin contar con una solución interoperable, centralizada y eficiente que les permita gestionar su infraestructura de carga de forma rentable y sostenible.",
                  "ValidacionProblema": "Tengo estudios previos propios o de terceros que respaldan la existencia del problema. ;Un cliente o aliado está pagando o pilotando la solución hoy.;Hice pruebas piloto con la solución real (aunque sea versión básica) con usuarios.",
                  "PersonasEntrevistadas": "Entre 16 y 30 personas.",
                  "ResultadoConversaciones": "La idea se mantuvo igual; los usuarios confirmaron exactamente lo que pensábamos.",
                  "TipoClientePrincipal": "Empresas o negocios (Vendes a empresas, emprendimientos o negocios)-B2B.",
                  "EvidenciaInteresSolucion": "Personas me han dicho verbalmente que les parece buena idea. ;Hay pilotos no pagados en curso o ya completados.",
                  "EvidenciaInteresOtro": "",
                  "ConocimientoCompetencia": "He mapeado a mis competidores directos y sé qué ofrecen.",
                  "EstimacionMercado": "He calculado TAM y SAM con fuentes citables.",
                  "AlcanceGeografico": "Varios países (internacional).",
                  "PropuestaValor": "Los desafíos de la movilidad eléctrica no solo están en la instalación de cargadores, sino en la integración tecnológica y operativa de toda la infraestructura. Muchas empresas enfrentan un ecosistema fragmentado donde cargadores, plataformas CMS y softwares de gestión no se comunican correctamente, generando incompatibilidades, fallas operativas y dificultades para centralizar el monitoreo, control y facturación de las estaciones. A esto se suman falta de soporte técnico especializado para integrar estas soluciones a la infraestructura eléctrica existente. El resultado son proyectos con retrasos, activos detenidos y redes de carga que no logran operar de manera confiable ni escalable. Muchas empresas terminan realizando la inversión, pero sin contar con una solución interoperable, centralizada y eficiente que les permita gestionar su infraestructura de carga de forma rentable y sostenible.",
                  "ClaridadValor": "La tengo estructurada",
                  "DiferenciaCompetencia": "Ofrecemos una alternativa con costos más eficientes.;Tenemos acceso a infraestructura, laboratorios o alianzas estratégicas.;Contamos con regulaciones, permisos o certificaciones relevantes para el sector.",
                  "SectorProductivo": "Tecnologías de la información y comunicación (TIC);Electrónica y semiconductores;Construcción e infraestructura",
                  "ModeloIngresos": "Combinación de varios de los anteriores.",
                  "Canales": "Venta directa por parte del equipo fundador (nosotros mismos vendemos).",
                  "AliadosEstrategicos": "Tengo acuerdos no vinculantes firmados (MoU, cartas de colaboración).",
                  "TieneVentas": "No",
                  "FacturacionTotal": "",
                  "PromedioVentasMensual3M": "",
                  "PuntoEquilibrio": "",
                  "RegistrosContablesDisponibles": "",
                  "EstadoProteccionPI": "Todavía no he pensado en proteger la PI.",
                  "TipoProteccionPI": "Registro de software.",
                  "DuenoLegalPI": "Todavía no está definida la titularidad.",
                  "LibertadOperacion": "He hecho una revisión informal (búsquedas rápidas en Google o bases de datos).",
                  "RolesEquipoCubiertos": "Investigador principal con dominio técnico-científico. ;Responsable de negocio o desarrollo comercial (alguien que piensa en cliente, ventas, modelo). ;Responsable de producto, UX o ingeniería aplicada.   TMRL;Responsable financiero u operaciones. ;Responsable de comunicación y relación con el ecosistema.",
                  "ExperienciaEmprendimientoTransferencia": "Alguien creó y operó una empresa exitosa.",
                  "DedicacionEquipo": "Entre 13 y 20 horas por semana.",
                  "DisponibilidadTiempoCompleto": "Sí, hay al menos una persona comprometida a hacerlo.",
                  "MujeresEquipo": "0",
                  "BonoEquidadAplica": false,
                  "JustificacionEquipoMercado": "Somos el equipo indicado porque hemos logrado una integración vertical única: unimos la rigurosidad de la infraestructura eléctrica y hardware con la escalabilidad de la ingeniería de software de alto nivel. Sebastian Medina, Ingeniero Electricista y Gerente de Proyectos, con 5 años de experiencia en el sector eléctrico aporta un conocimiento de mercado relevante. Actualmente, desde su rol estratégico en Motorysa BYD, líder en movilidad eléctrica en Colombia, ha gestionado el despliegue de 400+ estaciones de carga AC residencial, +5 estaciones de carga DC pública y 20 MWp en proyectos de infraestructura eléctrica, trabajando con operadores de red a nivel nacional como CELSIA, ENEL, EPM, EMSA y AIRE. Su dominio del RETIE, la normativa legal y la operación en campo elimina uno de los mayores riesgos de este negocio en cuanto a la operación del Hardware. Su experiencia técnica y comercial permite desarrollar y escalar el negocio de la movilidad eléctrica en el mercado colombiano. Juan Bustos, Ingeniero electrónico e Ingeniero de software con más de 6 años de experiencia en desarrollo de software, aporta la visión tecnológica y el desarrollo del ecosistema digital. Ha liderado integraciones, arquitecturas e implementaciones para plataformas financieras de gran escala con más de 15 millones de usuarios activos en Estados Unidos, trabajando en entornos de alta disponibilidad, estabilidad y seguridad. Su experiencia en desarrollo móvil, backend, infraestructura en la nube, observabilidad y liderazgo técnico permite construir una plataforma CMS robusta, interoperable y escalable, diseñada para garantizar una operación confiable de redes de carga. Nuestra ventaja definitiva es nuestra cohesión: somos amigos hace más de 15 años. Esta amistad no es solo un lazo personal; es uno de nuestros principales diferenciales. En un entorno de emprendimiento de alto riesgo, la alineación absoluta de valores y la confianza nos permiten una velocidad de ejecución y una toma de decisiones sin fricciones que un equipo recién formado no podría sostener. Conectamos la realidad física del sector eléctrico con la excelencia tecnológica necesaria para digitalizar la movilidad del futuro.",
                  "InversionAcumulada": "Entre 10 y 50 millones.",
                  "FuentesInversion": "Recursos propios del equipo o familia (FFF).",
                  "NecesidadFinanciera12Meses": "Entre 70 y 300 millones.",
                  "RecursosOperacion6Meses": "Sí, con holgura (más del 80% cubierto).",
                  "BuscaInversion": "No, por ahora no es una prioridad.",
                  "EstadoLegal": "Empresa constituida, activa y con operaciones regulares.",
                  "VerticalSostenibilidad": "Ciudades inteligentes y sostenibles. ;Energías renovables y eficiencia energética.",
                  "ODSRelacionados": "ODS 11: Ciudades y comunidades sostenibles;ODS 13: Acción por el clima ;ODS 7: Energía asequible y no contaminante",
                  "MideImpacto": "Todavía no hemos definido métricas de impacto.",
                  "RequiereRegulacion": "No requiere autorizaciones específicas.",
                  "EstadoTramitesRegulatorios": "No aplica (no requiere autorizaciones).",
                  "VideoPitchURL": "https://example.com/s2v-2026-005/video-pitch",
                  "URLAnexo1": "https://example.com/s2v-2026-005/anexo1",
                  "RetoPrograma": "Nuestro principal desafío es transformar una operación basada en proyectos de ingeniería a medida en un producto SaaS escalable y replicable para la gestión de infraestructura de carga eléctrica. Actualmente contamos con un piloto de cuatro cargadores y buscamos validar técnica y comercialmente nuestra plataforma para escalarla a nivel regional. Con el acompañamiento de Science2Venture queremos fortalecer tres frentes clave: primero, desarrollar un modelo comercial B2B escalable y replicable que nos permita convertir nuestra experiencia técnica en una solución fácilmente adoptable por empresas y operadores de carga; segundo, robustecer la arquitectura de nuestra plataforma para garantizar alta disponibilidad, interoperabilidad y estabilidad operativa en redes multimarca; y tercero, estructurar una estrategia de propiedad intelectual y diferenciación tecnológica alrededor de nuestro CMS y capacidades de integración, fortaleciendo nuestra posición competitiva en el mercado. Nuestro objetivo es consolidar una plataforma tecnológica desarrollada en Colombia, capaz de simplificar y centralizar la operación de infraestructura de carga para acelerar la adopción de la movilidad eléctrica en la región. Además, ofrecemos una solución integral que combina hardware, software e integración tecnológica en un solo ecosistema, permitiendo que nuestros clientes encuentren en un único aliado todo lo necesario para implementar, operar y escalar su infraestructura de carga, sin depender de múltiples proveedores.",
                  "EstadoPostulacion": "Recibida",
                  "CoherenciaTRLPreliminar": "Pendiente de revisión"
            },
            {
                  "IDOriginal": "7",
                  "IDIniciativa": "S2V-2026-006",
                  "NombreIniciativa": "Comunicación Sin Barreras",
                  "NombreLider": "Diana Carolina Vargas Forero",
                  "CorreoLider": "d***7@universidadean.edu.co",
                  "Ciudad": "Bogotá D.C.",
                  "VinculacionLider": "Estudiante",
                  "FacultadArea": "",
                  "RolIniciativa": "Investigador",
                  "SurgeGrupoSemillero": "No",
                  "GrupoOSemillero": "",
                  "AreaConocimiento": "Ingeniería y tecnología",
                  "EnfoqueProyecto": "Digital",
                  "DescripcionCorta": "Nuestro proyecto nació al identificar la dificultad para comunicarse que viven muchas personas con discapacidad auditiva cuando asisten al odontólogo. En la mayoría de los casos, la barrera de comunicación puede afectar la comprensión de síntomas, antecedentes médicos, diagnósticos y tratamientos, generando obstáculos que impactan la calidad de la atención. Para proponer una solución de este problema, desarrollamos una plataforma digital asistiva que utiliza recursos visuales y herramientas accesibles para facilitar la comunicación durante la consulta odontológica, especialmente en la etapa de anamnesis. La idea es que tanto el paciente como el profesional puedan intercambiar información de forma más sencilla, autónoma y comprensible. El impacto que buscamos generar con el proyecto es una atención más inclusiva, eficiente y humana, reduciendo las barreras comunicativas, mejorando la experiencia de los pacientes y promoviendo una mayor accesibilidad en los servicios de salud en Colombia.",
                  "PosturaEquityEan": "Si estoy de acuerdo con que la Universidad tenga participación.",
                  "AnioInicioTecnologia": "2026",
                  "TRLDeclarado": "TRL 5 Validación en entorno relevante",
                  "TRLNum": 5,
                  "RutaTRL": "TRL 4-6",
                  "CRLDeclarado": "CRL 4 Propuesta de valor",
                  "CRLNum": 4,
                  "BRLDeclarado": "BRL 2 Ajuste problema–solución",
                  "BRLNum": 2,
                  "EvidenciasTRL": "Tesis de pregrado, maestría o doctorado vinculada al proyecto. ;Prototipo físico o digital con fotos o videos que lo muestren funcionando.",
                  "EntornoPruebaTecnologia": "En entorno simulado que reproduce condiciones reales (pruebas de campo controladas).",
                  "BrechaTecnicaPrincipal": "Escalar el prototipo de laboratorio a condiciones reales (que funcione fuera del laboratorio).",
                  "TipoTecnologia": "Desarrollo una plataforma digital propia (app, sistema, marketplace) como base del negocio.",
                  "OrigenTecnologia": "Una parte la desarrollamos internamente; otra parte se apoya en herramientas existentes.",
                  "ComplejidadTecnica": "Medio",
                  "EvidenciasDocumentadas": "Sí, cuento con evidencias documentadas que pueden ser revisadas en esta convocatoria.",
                  "EvidenciasURL": "https://example.com/s2v-2026-006/evidencias",
                  "OrigenProblema": "Identificamos el problema por experiencia directa de alguien del equipo en ese sector.",
                  "DescripcionProblema": "Las personas que viven esta situación son principalmente aquellas con discapacidad auditiva que requieren atención odontológica. En Colombia, miles de personas de esta comunidad enfrentan barreras de comunicación cada vez que asisten a una consulta de salud, especialmente cuando no hay herramientas o personal capacitado que facilite la interacción con el profesional. Este problema puede presentarse con frecuencia en cada consulta, desde la primera valoración hasta los controles posteriores, ya que gran parte de la atención depende del intercambio de información verbal entre paciente y odontólogo. Las consecuencias pueden ser significativas: dificultades para expresar síntomas, antecedentes médicos, malentendidos sobre diagnósticos y tratamientos, aumento de los tiempos de atención e incluso una menor confianza para acudir nuevamente a los servicios de salud. Todo esto puede afectar la calidad de la atención recibida y limitar el acceso a una experiencia de salud inclusiva, segura y centrada en las necesidades del paciente.",
                  "ValidacionProblema": "Revisé literatura académica y reportes sectoriales que describen el problema.;Hice entrevistas estructuradas (con guion) con posibles clientes o usuarios. ;Hice pruebas piloto con la solución real (aunque sea versión básica) con usuarios.",
                  "PersonasEntrevistadas": "Entre 16 y 30 personas.",
                  "ResultadoConversaciones": "Ajustamos la propuesta de valor (lo que ofrecemos o cómo lo presentamos).",
                  "TipoClientePrincipal": "Gobierno o entidades públicas (Vendes a alcaldías, instituciones públicas o entidades del Estado)-B2G.;Empresas o negocios (Vendes a empresas, emprendimientos o negocios)-B2B.",
                  "EvidenciaInteresSolucion": "Personas me han dicho verbalmente que les parece buena idea. ;Otro",
                  "EvidenciaInteresOtro": "Encuestas estructuradas que reflejan interés por usuarios potenciales (Comunidad con discapacidad auditiva) y también se realizaron pilotos con dichos usuarios",
                  "ConocimientoCompetencia": "He identificado algunas soluciones alternativas o sustitutas.",
                  "EstimacionMercado": "Tengo una idea general, pero sin números respaldados por fuentes.",
                  "AlcanceGeografico": "Todo el territorio nacional.",
                  "PropuestaValor": "Para instituciones de salud como EPS, IPS o consultorios independientes, que manejen el servicio de odontología y nuestro producto apoya la interacción paciente-odontólogo, cuando el paciente hace parte de la comunidad con discapacidad auditiva. La aplicación se diferencia en que está diseñada para promover la inclusión de la comunidad con discapacidad auditiva dándoles una herramienta accesible y eficiente.",
                  "ClaridadValor": "La tengo estructurada",
                  "DiferenciaCompetencia": "Tenemos acceso a datos propios o información diferenciadora.;Nuestra comunidad o red de usuarios fortalece el crecimiento de la iniciativa.",
                  "SectorProductivo": "Ciencias de la vida (salud, genómica, bioinformática);Tecnologías de la información y comunicación (TIC)",
                  "ModeloIngresos": "Combinación de varios de los anteriores.",
                  "Canales": "Venta directa por parte del equipo fundador (nosotros mismos vendemos).",
                  "AliadosEstrategicos": "Estoy en conversaciones informales con posibles aliados.",
                  "TieneVentas": "No",
                  "FacturacionTotal": "",
                  "PromedioVentasMensual3M": "",
                  "PuntoEquilibrio": "",
                  "RegistrosContablesDisponibles": "",
                  "EstadoProteccionPI": "He hecho un análisis preliminar pero no tenemos protección formal aún.",
                  "TipoProteccionPI": "Patente de invención.",
                  "DuenoLegalPI": "Todavía no está definida la titularidad.",
                  "LibertadOperacion": "He hecho un análisis preliminar con búsqueda básica en bases de patentes.",
                  "RolesEquipoCubiertos": "Investigador principal con dominio técnico-científico. ;Co-investigador técnico que complementa al principal. ;Responsable de negocio o desarrollo comercial (alguien que piensa en cliente, ventas, modelo). ;Responsable de producto, UX o ingeniería aplicada.   TMRL;Responsable de comunicación y relación con el ecosistema. ;Responsable financiero u operaciones. ;Responsable de propiedad intelectual y asuntos legales.",
                  "ExperienciaEmprendimientoTransferencia": "Alguien creó y operó una empresa exitosa.",
                  "DedicacionEquipo": "Entre 9 y 12 horas por semana.",
                  "DisponibilidadTiempoCompleto": "Sí, hay al menos una persona comprometida a hacerlo.",
                  "MujeresEquipo": "3",
                  "BonoEquidadAplica": true,
                  "JustificacionEquipoMercado": "Nuestro equipo se conforma de 3 ingenieras con habilidades interdisciplinarias (Ingeniería industrial y de sistemas) cerca de graduarse de la universidad EAN, tenemos experiencia con personas que requieren de este servicio y parte de las integrantes tienen conexiones con EPS que puede facilitar las alianzas comerciales.",
                  "InversionAcumulada": "Menos de 10 millones de COP.",
                  "FuentesInversion": "Recursos propios del equipo o familia (FFF).",
                  "NecesidadFinanciera12Meses": "Entre 20 y 70 millones.",
                  "RecursosOperacion6Meses": "Sí, con holgura (más del 80% cubierto).",
                  "BuscaInversion": "No, por ahora no es una prioridad.",
                  "EstadoLegal": "Estoy evaluando qué figura jurídica sería la adecuada (SAS, Ltda, etc.).",
                  "VerticalSostenibilidad": "Salud y biotecnología.;Diversidades y equidad.",
                  "ODSRelacionados": "ODS 3: Salud y bienestar;ODS 10: Reducción de las desigualdades",
                  "MideImpacto": "Hemos medido el impacto en pilotos o escenarios controlados.",
                  "RequiereRegulacion": "No requiere autorizaciones específicas.",
                  "EstadoTramitesRegulatorios": "No aplica (no requiere autorizaciones).",
                  "VideoPitchURL": "https://example.com/s2v-2026-006/video-pitch",
                  "URLAnexo1": "https://example.com/s2v-2026-006/anexo1",
                  "RetoPrograma": "Lograr un Plan de go-tomarket definido y una estrategia de PI.",
                  "EstadoPostulacion": "Recibida",
                  "CoherenciaTRLPreliminar": "Pendiente de revisión"
            },
            {
                  "IDOriginal": "8",
                  "IDIniciativa": "S2V-2026-007",
                  "NombreIniciativa": "EcoVisión IA",
                  "NombreLider": "Daniel David Castañeda Moncada",
                  "CorreoLider": "d***0@universidadean.edu.co",
                  "Ciudad": "Bogotá D.C",
                  "VinculacionLider": "Estudiante",
                  "FacultadArea": "",
                  "RolIniciativa": "Investigador y Desarrollador",
                  "SurgeGrupoSemillero": "No",
                  "GrupoOSemillero": "",
                  "AreaConocimiento": "Ingeniería y tecnología",
                  "EnfoqueProyecto": "Base tecnológica",
                  "DescripcionCorta": "El proyecto EcoVisión IA es un sistema de canecas, que utiliza sensores para detectar el tipo de residuo ingresado y clasificarlo, a través de Inteligencia Artificial entrenada. El proyecto busca implementar nuevas tecnologías para ayudar a la correcta separación de residuos y, de manera indirecta, generar consciencia ambiental.",
                  "PosturaEquityEan": "Si estoy de acuerdo con que la Universidad tenga participación.",
                  "AnioInicioTecnologia": "2026",
                  "TRLDeclarado": "TRL 4 Prueba experimental de concepto",
                  "TRLNum": 4,
                  "RutaTRL": "TRL 4-6",
                  "CRLDeclarado": "CRL 4 Propuesta de valor",
                  "CRLNum": 4,
                  "BRLDeclarado": "BRL 2 Ajuste problema–solución",
                  "BRLNum": 2,
                  "EvidenciasTRL": "Reporte técnico interno con resultados experimentales documentados. ;Tesis de pregrado, maestría o doctorado vinculada al proyecto. ;Prototipo físico o digital con fotos o videos que lo muestren funcionando.",
                  "EntornoPruebaTecnologia": "En entorno simulado que reproduce condiciones reales (pruebas de campo controladas).",
                  "BrechaTecnicaPrincipal": "Asegurar que el prototipo sea confiable, reproducible y dure lo suficiente para ser usado.",
                  "TipoTecnologia": "Estoy creando tecnología propia como producto principal (software, IA entrenada, SaaS, API, hardware).",
                  "OrigenTecnologia": "Una parte la desarrollamos internamente; otra parte se apoya en herramientas existentes.",
                  "ComplejidadTecnica": "Alto",
                  "EvidenciasDocumentadas": "Sí, cuento con evidencias documentadas que pueden ser revisadas en esta convocatoria.",
                  "EvidenciasURL": "https://example.com/s2v-2026-007/evidencias",
                  "OrigenProblema": "Partimos de una tecnología o hallazgo científico interesante y estamos buscando dónde aplicarla.",
                  "DescripcionProblema": "En las empresas, instituciones o espacios públicos, los usuarios no siempre tienen conocimientos de en qué caneca de color debe ir el alimento, producto o servicio que van a depositar, es por eso que los residuos se acumulan sin separación y dificulta luego su recolección de materiales aprovechables. Por esto mismo, muchos residuos con utilidad terminan en rellenos sanitarios, son contaminados por lixiviados y terminan siendo inutilizables para procesos futuros.",
                  "ValidacionProblema": "Revisé literatura académica y reportes sectoriales que describen el problema.;Hice encuestas cuantitativas con posibles clientes. ;Hice entrevistas informales con personas que podrían ser usuarios o clientes.",
                  "PersonasEntrevistadas": "Entre 6 y 15 personas.",
                  "ResultadoConversaciones": "La idea se mantuvo igual; los usuarios confirmaron exactamente lo que pensábamos.",
                  "TipoClientePrincipal": "Consumidor final (Vendes directamente a personas para uso personal)-B2C.;Empresas o negocios (Vendes a empresas, emprendimientos o negocios)-B2B.;Gobierno o entidades públicas (Vendes a alcaldías, instituciones públicas o entidades del Estado)-B2G.",
                  "EvidenciaInteresSolucion": "Personas me han dicho verbalmente que les parece buena idea.",
                  "EvidenciaInteresOtro": "",
                  "ConocimientoCompetencia": "Creo que no existe competencia directa para lo que hago.",
                  "EstimacionMercado": "Tengo una idea general, pero sin números respaldados por fuentes.",
                  "AlcanceGeografico": "Solo un municipio (local).",
                  "PropuestaValor": "Las canecas reducen el error de deposición de residuos en las canecas no correspondientes. De esta manera, el material aprovechable limpio puede ser valorizado y reintegrado en nuevas cadenas de valor. Generando economía circular y sostenibilidad.",
                  "ClaridadValor": "La tengo estructurada",
                  "DiferenciaCompetencia": "Tenemos acceso a datos propios o información diferenciadora.",
                  "SectorProductivo": "Economía verde y circular (sostenibilidad, reciclaje, carbono neutro)",
                  "ModeloIngresos": "Venta única del producto o servicio (el cliente paga una vez).",
                  "Canales": "Venta directa por parte del equipo fundador (nosotros mismos vendemos).",
                  "AliadosEstrategicos": "Todavía no tengo aliados formales.",
                  "TieneVentas": "No",
                  "FacturacionTotal": "",
                  "PromedioVentasMensual3M": "",
                  "PuntoEquilibrio": "",
                  "RegistrosContablesDisponibles": "",
                  "EstadoProteccionPI": "He hecho un análisis preliminar pero no tenemos protección formal aún.",
                  "TipoProteccionPI": "Todavía no aplicamos ninguno.",
                  "DuenoLegalPI": "Todavía no está definida la titularidad.",
                  "LibertadOperacion": "He hecho una revisión informal (búsquedas rápidas en Google o bases de datos).",
                  "RolesEquipoCubiertos": "Investigador principal con dominio técnico-científico. ;Co-investigador técnico que complementa al principal.",
                  "ExperienciaEmprendimientoTransferencia": "Ninguno tiene experiencia previa.",
                  "DedicacionEquipo": "Entre 9 y 12 horas por semana.",
                  "DisponibilidadTiempoCompleto": "No, todos seguiremos en dedicación parcial.",
                  "MujeresEquipo": "1",
                  "BonoEquidadAplica": true,
                  "JustificacionEquipoMercado": "Consideramos que tenemos habilidad de adaptar a las necesidades de la actualidad y en el desarrollo de proyectos técnicos. Además somos un grupo multidisciplinar del area de ingeniería de sistemas e ingenieria ambiental, aportando conocimientos propios, académicos y experimentados.",
                  "InversionAcumulada": "Menos de 10 millones de COP.",
                  "FuentesInversion": "Recursos propios del equipo o familia (FFF).",
                  "NecesidadFinanciera12Meses": "Menos de 20 millones de COP.",
                  "RecursosOperacion6Meses": "Sí, pero ajustado (entre 50% y 80%).",
                  "BuscaInversion": "Sí, estamos en etapa de preparación (deck, proyecciones, pitch).",
                  "EstadoLegal": "Todavía no he pensado en constituir empresa.",
                  "VerticalSostenibilidad": "Economía circular.;Ciudades inteligentes y sostenibles.",
                  "ODSRelacionados": "ODS 11: Ciudades y comunidades sostenibles;ODS 12: Producción y consumo responsables",
                  "MideImpacto": "Tenemos métricas cuantificables propuestas, pero aún no las medimos.",
                  "RequiereRegulacion": "No requiere autorizaciones específicas.",
                  "EstadoTramitesRegulatorios": "No aplica (no requiere autorizaciones).",
                  "VideoPitchURL": "https://example.com/s2v-2026-007/video-pitch",
                  "URLAnexo1": "https://example.com/s2v-2026-007/anexo1",
                  "RetoPrograma": "Financiación de materiales de mayor calidad, instrumentos para optimizar procesos y adaptación en entornos reales.",
                  "EstadoPostulacion": "Recibida",
                  "CoherenciaTRLPreliminar": "Pendiente de revisión"
            },
            {
                  "IDOriginal": "9",
                  "IDIniciativa": "S2V-2026-008",
                  "NombreIniciativa": "Sapere Aude",
                  "NombreLider": "Adriana Santos Sierra",
                  "CorreoLider": "a***a@gmail.com",
                  "Ciudad": "Bogotá",
                  "VinculacionLider": "Estudiante",
                  "FacultadArea": "",
                  "RolIniciativa": "Investigadora, creadora",
                  "SurgeGrupoSemillero": "Sí, de un semillero",
                  "GrupoOSemillero": "In Other Words",
                  "AreaConocimiento": "Combinación de varias áreas (interdisciplinar)",
                  "EnfoqueProyecto": "Base científica",
                  "DescripcionCorta": "Nuestro proyecto brinda acompañamiento académico personalizado y servicios de consultoría en áreas como matemáticas, ciencias sociales, idiomas, enfermería, administración y mercadeo. A través de asesorías, clases virtuales y procesos de consultoría, así como contenido educativo en redes sociales, hacemos que el aprendizaje y la aplicación del conocimiento sean más claros, prácticos y accesibles.  El problema que resolvemos es la falta de apoyo individualizado y de orientación especializada, lo que genera frustración, bajo rendimiento y desmotivación en estudiantes y en personas que necesitan aplicar conocimientos en contextos académicos o profesionales.  Nuestro impacto se refleja en mejorar la comprensión, la confianza y el desempeño académico, además de fortalecer la toma de decisiones y el desarrollo de habilidades prácticas en distintos contextos educativos y laborales.",
                  "PosturaEquityEan": "Si estoy de acuerdo con que la Universidad tenga participación.",
                  "AnioInicioTecnologia": "2021",
                  "TRLDeclarado": "TRL 7 Prototipo en entorno de operación",
                  "TRLNum": 7,
                  "RutaTRL": "TRL 7-9",
                  "CRLDeclarado": "CRL 4 Propuesta de valor",
                  "CRLNum": 4,
                  "BRLDeclarado": "BRL 4 Definición de cliente",
                  "BRLNum": 4,
                  "EvidenciasTRL": "Ponencia o presentación en evento científico o tecnológico. ;Prototipo físico o digital con fotos o videos que lo muestren funcionando.",
                  "EntornoPruebaTecnologia": "En operación real continuada, con usuarios o clientes que la usan regularmente.",
                  "BrechaTecnicaPrincipal": "Asegurar que el prototipo sea confiable, reproducible y dure lo suficiente para ser usado.",
                  "TipoTecnologia": "Uso tecnologías avanzadas existentes (IA comercial, software especializado, analítica avanzada).",
                  "OrigenTecnologia": "Combinamos varias tecnologías existentes para crear algo nuevo que antes no existía así.",
                  "ComplejidadTecnica": "Bajo",
                  "EvidenciasDocumentadas": "Sí, cuento con evidencias documentadas que pueden ser revisadas en esta convocatoria.",
                  "EvidenciasURL": "https://example.com/s2v-2026-008/evidencias",
                  "OrigenProblema": "Identificamos el problema por experiencia directa de alguien del equipo en ese sector.",
                  "DescripcionProblema": "El proyecto aborda las dificultades académicas y de orientación que enfrentan estudiantes de diferentes niveles (escolar y universitario), así como personas que requieren apoyo en la aplicación de conocimientos en áreas como matemáticas, ciencias sociales, idiomas, enfermería, administración y mercadeo. Este problema se presenta de manera frecuente durante su proceso educativo o profesional, especialmente en momentos de alta exigencia académica, evaluaciones o toma de decisiones prácticas.  Estas dificultades generan bajo rendimiento, frustración, desmotivación e incluso riesgo de deserción académica o inseguridad al momento de aplicar conocimientos en contextos reales. A partir de la experiencia directa en el sector educativo y el trabajo con estudiantes, se identificó la necesidad de acompañamiento personalizado y consultoría académica que brinde estrategias de aprendizaje y aplicación más efectivas.  La solución busca ofrecer apoyo académico y consultoría accesible, comprensible y adaptada a las necesidades individuales, facilitando la comprensión de los temas, la toma de decisiones y fortaleciendo la confianza y el desempeño de los usuarios.",
                  "ValidacionProblema": "Revisé literatura académica y reportes sectoriales que describen el problema.;Hice entrevistas informales con personas que podrían ser usuarios o clientes. ;Hice pruebas piloto con la solución real (aunque sea versión básica) con usuarios.",
                  "PersonasEntrevistadas": "Entre 1 y 5 personas.",
                  "ResultadoConversaciones": "Ajustamos la propuesta de valor (lo que ofrecemos o cómo lo presentamos).",
                  "TipoClientePrincipal": "Empresas o negocios (Vendes a empresas, emprendimientos o negocios)-B2B.;Consumidor final (Vendes directamente a personas para uso personal)-B2C.;Gobierno o entidades públicas (Vendes a alcaldías, instituciones públicas o entidades del Estado)-B2G.",
                  "EvidenciaInteresSolucion": "Personas me han dicho verbalmente que les parece buena idea.",
                  "EvidenciaInteresOtro": "",
                  "ConocimientoCompetencia": "He hecho un análisis comparativo formal (benchmark",
                  "EstimacionMercado": "Tengo una idea general, pero sin números respaldados por fuentes.",
                  "AlcanceGeografico": "Varios países (internacional).",
                  "PropuestaValor": "Para estudiantes y personas que necesitan fortalecer o aplicar conocimientos en áreas como matemáticas, ciencias sociales, idiomas, enfermería, administración y mercadeo, nuestro proyecto ofrece acompañamiento académico y consultoría personalizada. Resolvemos dificultades de comprensión, desmotivación y falta de orientación práctica mediante asesorías y clases virtuales adaptadas a cada necesidad. Nos diferenciamos por integrar enseñanza personalizada con consultoría aplicada, haciendo el aprendizaje más claro, útil y conectado con situaciones reales.",
                  "ClaridadValor": "Está estructurada, validada y ajustada varias veces con base en lo aprendido del mercado.",
                  "DiferenciaCompetencia": "Contamos con know-how o conocimiento especializado difícil de replicar.;Nuestra comunidad o red de usuarios fortalece el crecimiento de la iniciativa.;Tenemos una marca o posicionamiento temprano en el mercado.",
                  "SectorProductivo": "Industrias creativas y culturales (videojuegos, diseño, contenidos digitales);Tecnologías de la información y comunicación (TIC);Economía digital (plataformas, comercio electrónico, fintech)",
                  "ModeloIngresos": "Servicios asociados (consultoría, implementación, mantenimiento).",
                  "Canales": "Plataforma digital o e-commerce propio.",
                  "AliadosEstrategicos": "Todavía no tengo aliados formales.",
                  "TieneVentas": "Sí",
                  "FacturacionTotal": "5.000.000",
                  "PromedioVentasMensual3M": "0",
                  "PuntoEquilibrio": "Aún no",
                  "RegistrosContablesDisponibles": "Llevamos registros básicos informales (una hoja de Excel, apuntes).",
                  "EstadoProteccionPI": "Ya radicamos una solicitud ante la SIC u otra autoridad competente.",
                  "TipoProteccionPI": "Registro de marca.",
                  "DuenoLegalPI": "Ean con co-titularidad de los investigadores.",
                  "LibertadOperacion": "He hecho una revisión informal (búsquedas rápidas en Google o bases de datos).",
                  "RolesEquipoCubiertos": "Investigador principal con dominio técnico-científico. ;Responsable de producto, UX o ingeniería aplicada.   TMRL;Responsable de propiedad intelectual y asuntos legales.;Responsable financiero u operaciones. ;Responsable de comunicación y relación con el ecosistema.",
                  "ExperienciaEmprendimientoTransferencia": "Alguien participó en programas formativos de emprendimiento (cursos, bootcamps).",
                  "DedicacionEquipo": "Entre 5 y 8 horas por semana.",
                  "DisponibilidadTiempoCompleto": "Sí, hay al menos una persona comprometida a hacerlo.",
                  "MujeresEquipo": "1",
                  "BonoEquidadAplica": true,
                  "JustificacionEquipoMercado": "Somos el equipo adecuado para llevar esta solución al mercado porque contamos con experiencia directa en el sector educativo y en la aplicación práctica de conocimientos en contextos reales. Hemos trabajado acompañando estudiantes en áreas como matemáticas, ciencias sociales, idiomas, enfermería, administración y mercadeo, lo que nos ha permitido entender de primera mano sus principales dificultades de aprendizaje y orientación.  Además, combinamos formación y experiencia en áreas de alta exigencia académica y profesional, lo que nos da la capacidad de traducir conceptos complejos en explicaciones claras y aplicables. Hemos validado la necesidad del acompañamiento personalizado a través del trabajo directo con usuarios y la creación de contenido educativo.  Esta combinación de experiencia práctica, conocimiento disciplinar y cercanía con los usuarios nos permite diseñar soluciones ajustadas a necesidades reales y con alto potencial de impacto.",
                  "InversionAcumulada": "Menos de 10 millones de COP.",
                  "FuentesInversion": "Recursos propios del equipo o familia (FFF).",
                  "NecesidadFinanciera12Meses": "Todavía no lo he estimado.",
                  "RecursosOperacion6Meses": "No.",
                  "BuscaInversion": "Sí, estamos en etapa de preparación (deck, proyecciones, pitch).",
                  "EstadoLegal": "Estoy evaluando qué figura jurídica sería la adecuada (SAS, Ltda, etc.).",
                  "VerticalSostenibilidad": "EdTech.;Educación inclusiva para el futuro.",
                  "ODSRelacionados": "ODS 4: Educación de calidad;ODS 8: Trabajo decente y crecimiento económico;ODS 10: Reducción de las desigualdades",
                  "MideImpacto": "Tenemos métricas cuantificables propuestas, pero aún no las medimos.",
                  "RequiereRegulacion": "No requiere autorizaciones específicas.",
                  "EstadoTramitesRegulatorios": "No aplica (no requiere autorizaciones).",
                  "VideoPitchURL": "https://example.com/s2v-2026-008/video-pitch",
                  "URLAnexo1": "https://example.com/s2v-2026-008/anexo1",
                  "RetoPrograma": "El principal reto que queremos abordar con el acompañamiento de Science2Venture es fortalecer la validación y estructuración del modelo de negocio de nuestro proyecto educativo y de consultoría, con el fin de consolidar su sostenibilidad y escalabilidad.  Buscamos mejorar la definición de nuestro modelo financiero, la validación con clientes y la estandarización del servicio, para pasar de una operación basada en experiencias individuales a un modelo replicable, medible y con mayor alcance.  Adicionalmente, queremos recibir acompañamiento para estructurar mejor nuestra estrategia de crecimiento, diferenciación en el mercado EdTech y preparación para procesos de inversión y formalización.",
                  "EstadoPostulacion": "Recibida",
                  "CoherenciaTRLPreliminar": "Pendiente de revisión"
            },
            {
                  "IDOriginal": "10",
                  "IDIniciativa": "S2V-2026-009",
                  "NombreIniciativa": "Mi Terreno Colombia",
                  "NombreLider": "Angie Nathalia Aguirre Rosero",
                  "CorreoLider": "a***9@universidadean.edu.co",
                  "Ciudad": "Bogotá D.C.",
                  "VinculacionLider": "Estudiante",
                  "FacultadArea": "",
                  "RolIniciativa": "Lider",
                  "SurgeGrupoSemillero": "No",
                  "GrupoOSemillero": "",
                  "AreaConocimiento": "Ciencias agrícolas",
                  "EnfoqueProyecto": "Base tecnológica",
                  "DescripcionCorta": "Mi Terreno Colombia es una herramienta digital que ayuda a los campesinos y pequeños agricultores de Colombia a organizarse mejor, planificar su trabajo en el campo y tomar decisiones con información clara. El problema es que la mayoría de estos agricultores trabajan solos, sin apoyo técnico ni herramientas para crecer. Eso les impide acceder a mercados, obtener recursos del gobierno o unirse con otros productores. Mi Terreno resuelve eso: les da acompañamiento práctico, formación sencilla y datos útiles para que puedan asociarse, producir mejor y mejorar sus ingresos. En pocas palabras: ponemos tecnología al servicio del campo colombiano.",
                  "PosturaEquityEan": "Si estoy de acuerdo con que la Universidad tenga participación.",
                  "AnioInicioTecnologia": "2026",
                  "TRLDeclarado": "TRL 1 Observaciones de principios básicos",
                  "TRLNum": 1,
                  "RutaTRL": "TRL 1-3",
                  "CRLDeclarado": "CRL 1 Hipótesis",
                  "CRLNum": 1,
                  "BRLDeclarado": "BRL 1 Concepto inicial",
                  "BRLNum": 1,
                  "EvidenciasTRL": "Todavía no tenemos evidencias documentadas.",
                  "EntornoPruebaTecnologia": "Todavía no la he probado físicamente (solo en papel, modelado o simulación).",
                  "BrechaTecnicaPrincipal": "Sinceramente, no tengo claro cuáles son las brechas técnicas pendientes.",
                  "TipoTecnologia": "Desarrollo una plataforma digital propia (app, sistema, marketplace) como base del negocio.",
                  "OrigenTecnologia": "Una parte la desarrollamos internamente; otra parte se apoya en herramientas existentes.",
                  "ComplejidadTecnica": "Medio",
                  "EvidenciasDocumentadas": "No cuento todavía con evidencias documentadas del avance técnico.",
                  "EvidenciasURL": "",
                  "OrigenProblema": "Identificamos el problema por experiencia directa de alguien del equipo en ese sector.",
                  "DescripcionProblema": "Los pequeños productores de la ACFEC viven a diario una paradoja: aportan cerca del 70% de los alimentos de la canasta básica colombiana, pero operan solos, sin herramientas ni acompañamiento. Solo 1 de cada 10 participa en asociaciones, no por falta de voluntad, sino porque asociarse es costoso, complejo y genera desconfianza. Lo viví directamente en salidas de campo universitarias y lo confirmé trabajando en el Ministerio de Agricultura, donde convocatorias diseñadas para el campo quedaban desiertas porque los productores no estaban organizados. El problema es estructural: el 86.3% de las organizaciones rurales tiene debilidades en gestión, más del 80% no recibe asistencia técnica regular y no existe en Colombia una herramienta que las acompañe de forma práctica y autónoma. Cada productor que fracasa es una familia que pierde su sustento y alimentos que no llegan a las mesas colombianas.",
                  "ValidacionProblema": "Revisé literatura académica y reportes sectoriales que describen el problema.;Tengo estudios previos propios o de terceros que respaldan la existencia del problema.",
                  "PersonasEntrevistadas": "Todavía ninguna. No he tenido conversaciones con posibles usuarios.",
                  "ResultadoConversaciones": "Aún no he tenido esas conversaciones.",
                  "TipoClientePrincipal": "Consumidor final (Vendes directamente a personas para uso personal)-B2C.",
                  "EvidenciaInteresSolucion": "Personas me han dicho verbalmente que les parece buena idea.",
                  "EvidenciaInteresOtro": "",
                  "ConocimientoCompetencia": "Creo que no existe competencia directa para lo que hago.",
                  "EstimacionMercado": "He calculado el TAM (mercado total) con datos secundarios.",
                  "AlcanceGeografico": "Todo el territorio nacional.",
                  "PropuestaValor": "Para los pequeños productores y de la ACFEC colombiana que no cuentan con asistencia técnica regular ni herramientas para organizarse y crecer, Mi Terreno Colombia ofrece la única plataforma tecnológica que combina formación práctica, gestión asociativa y datos para la toma de decisiones. A diferencia de los modelos tradicionales, co-creamos con las comunidades desde sus saberes territoriales, generando autonomía real y sostenible sin depender de acompañamiento externo.",
                  "ClaridadValor": "La tengo estructurada",
                  "DiferenciaCompetencia": "Tenemos una marca o posicionamiento temprano en el mercado.;Nuestra comunidad o red de usuarios fortalece el crecimiento de la iniciativa.",
                  "SectorProductivo": "Agroindustria y agroalimentario",
                  "ModeloIngresos": "Combinación de varios de los anteriores.",
                  "Canales": "Plataforma digital o e-commerce propio.",
                  "AliadosEstrategicos": "Estoy en conversaciones informales con posibles aliados.",
                  "TieneVentas": "No",
                  "FacturacionTotal": "",
                  "PromedioVentasMensual3M": "",
                  "PuntoEquilibrio": "",
                  "RegistrosContablesDisponibles": "",
                  "EstadoProteccionPI": "Todavía no he pensado en proteger la PI.",
                  "TipoProteccionPI": "Todavía no aplicamos ninguno.",
                  "DuenoLegalPI": "Todavía no está definida la titularidad.",
                  "LibertadOperacion": "No he considerado ese tema.",
                  "RolesEquipoCubiertos": "Responsable de negocio o desarrollo comercial (alguien que piensa en cliente, ventas, modelo). ;Investigador principal con dominio técnico-científico.",
                  "ExperienciaEmprendimientoTransferencia": "Alguien participó en programas formativos de emprendimiento (cursos, bootcamps).",
                  "DedicacionEquipo": "Entre 9 y 12 horas por semana.",
                  "DisponibilidadTiempoCompleto": "Sí, hay al menos una persona comprometida a hacerlo.",
                  "MujeresEquipo": "1",
                  "BonoEquidadAplica": true,
                  "JustificacionEquipoMercado": "Soy nutricionista dietista con formación en seguridad alimentaria en Brasil y estudiante de la Maestría en Gerencia de Proyectos, apasionada por el Derecho Humano a la Alimentación — una causa que conozco también desde la experiencia propia. He trabajado en el Ministerio de Agricultura, el ICBF, el Congreso de la República y en voluntariados en ruralidad y zonas de conflicto, lo que me dio una comprensión profunda y real de las barreras que enfrentan los productores campesinos. Tengo contacto directo con representantes de organizaciones ACFEC, docentes de la Universidad Nacional y funcionarios de ADR, UPRA, ICA y AUNAP. Y más importante aún, cuento con vínculos comunitarios en territorio. No llegué a este problema desde un escritorio, lo viví, lo investigué y quiero construí la solución desde adentro a partir de la co-creación y el diálogo de saberes.",
                  "InversionAcumulada": "Menos de 10 millones de COP.",
                  "FuentesInversion": "Recursos propios del equipo o familia (FFF).",
                  "NecesidadFinanciera12Meses": "Entre 20 y 70 millones.",
                  "RecursosOperacion6Meses": "No.",
                  "BuscaInversion": "No, por ahora no es una prioridad.",
                  "EstadoLegal": "Todavía no he pensado en constituir empresa.",
                  "VerticalSostenibilidad": "AgroTech. ;Seguridad alimentaria.",
                  "ODSRelacionados": "ODS 2: Hambre cero;ODS 8: Trabajo decente y crecimiento económico",
                  "MideImpacto": "Todavía no hemos definido métricas de impacto.",
                  "RequiereRegulacion": "No requiere autorizaciones específicas.",
                  "EstadoTramitesRegulatorios": "No aplica (no requiere autorizaciones).",
                  "VideoPitchURL": "https://example.com/s2v-2026-009/video-pitch",
                  "URLAnexo1": "https://example.com/s2v-2026-009/anexo1",
                  "RetoPrograma": "Quiero avanzar con la validación de la propuesta de negocio, implementar el PMV, realizar entrevistas, avanzar en identificar la sostenibilidad económica, me gustaría recibir ayuda sobre la conformación de la empresa y cómo establecer el precio de venta, y demás requisitos que sean necesarios para que el proyecto salga al mercado en 2027.",
                  "EstadoPostulacion": "Recibida",
                  "CoherenciaTRLPreliminar": "Pendiente de revisión"
            },
            {
                  "IDOriginal": "11",
                  "IDIniciativa": "S2V-2026-010",
                  "NombreIniciativa": "HandTalk CB",
                  "NombreLider": "ESTEFANIA RODRIGUEZ MOSQUERA",
                  "CorreoLider": "e***6@universidadean.edu.co",
                  "Ciudad": "Bogotá D.C",
                  "VinculacionLider": "Estudiante",
                  "FacultadArea": "",
                  "RolIniciativa": "Investigador principal",
                  "SurgeGrupoSemillero": "No",
                  "GrupoOSemillero": "",
                  "AreaConocimiento": "Ingeniería y tecnología",
                  "EnfoqueProyecto": "Tecnología avanzada",
                  "DescripcionCorta": "Nuestro proyecto, HandTalk Bot, busca facilitar la comunicación entre las personas sordas y la tecnología mediante inteligencia artificial y visión artificial. Actualmente contamos con un prototipo híbrido básico de reconocimiento estático, capaz de identificar letras y palabras de la Lengua de Señas Colombiana (LSC) utilizando una cámara convencional y modelos de aprendizaje automático.  Durante el desarrollo identificamos una gran brecha tecnológica en Colombia: existen pocos datasets especializados en LSC y la mayoría de investigaciones se enfocan en señas estáticas, mientras que a nivel internacional ya se trabaja en reconocimiento dinámico e interacción con robots.  Nuestra meta es evolucionar este prototipo hacia el reconocimiento de señas en movimiento mediante arquitecturas avanzadas como Transformers, modelos CNN-LSTM y técnicas Multi-Cue, capaces de interpretar manos, rostro y cuerpo simultáneamente. A futuro, buscamos integrar esta tecnología en robots y asistentes inteligentes para reducir barreras de comunicación y promover la inclusión de la comunidad sorda colombiana.",
                  "PosturaEquityEan": "Si estoy de acuerdo con que la Universidad tenga participación.",
                  "AnioInicioTecnologia": "2026",
                  "TRLDeclarado": "TRL 4 Prueba experimental de concepto",
                  "TRLNum": 4,
                  "RutaTRL": "TRL 4-6",
                  "CRLDeclarado": "CRL 4 Propuesta de valor",
                  "CRLNum": 4,
                  "BRLDeclarado": "BRL 2 Ajuste problema–solución",
                  "BRLNum": 2,
                  "EvidenciasTRL": "Tesis de pregrado, maestría o doctorado vinculada al proyecto. ;Prototipo físico o digital con fotos o videos que lo muestren funcionando.",
                  "EntornoPruebaTecnologia": "Solo en laboratorio controlado (universidad u otra institución)",
                  "BrechaTecnicaPrincipal": "Escalar el prototipo de laboratorio a condiciones reales (que funcione fuera del laboratorio).",
                  "TipoTecnologia": "Estoy creando tecnología propia como producto principal (software, IA entrenada, SaaS, API, hardware).",
                  "OrigenTecnologia": "Una parte la desarrollamos internamente; otra parte se apoya en herramientas existentes.",
                  "ComplejidadTecnica": "Alto",
                  "EvidenciasDocumentadas": "Estoy preparando la documentación, pero aún no cuento con soportes listos para revisión.",
                  "EvidenciasURL": "",
                  "OrigenProblema": "Identificamos el problema leyendo literatura académica, reportes del sector o noticias.",
                  "DescripcionProblema": "Las personas sordas en Colombia enfrentan barreras de comunicación todos los días en entornos educativos, institucionales, laborales y de atención al público. Aunque existen avances en inteligencia artificial para el reconocimiento de lenguaje de señas, la mayoría de las soluciones están desarrolladas para otros idiomas de señas y no para la Lengua de Señas Colombiana (LSC). Además, en Colombia existe una escasez de datasets especializados y de tecnologías capaces de interpretar señas de manera eficiente e integrarse con sistemas inteligentes o robots.  Esta situación limita la inclusión y el acceso equitativo a servicios y herramientas tecnológicas. Nuestro proyecto busca abordar este problema mediante el desarrollo de un sistema basado en inteligencia artificial y visión artificial que permita reconocer la LSC y sirva como base para futuras aplicaciones en robots y asistentes inteligentes, facilitando una comunicación más accesible e inclusiva para la comunidad sorda colombiana.",
                  "ValidacionProblema": "Revisé literatura académica y reportes sectoriales que describen el problema.",
                  "PersonasEntrevistadas": "Todavía ninguna. No he tenido conversaciones con posibles usuarios.",
                  "ResultadoConversaciones": "Aún no he tenido esas conversaciones.",
                  "TipoClientePrincipal": "Empresas o negocios (Vendes a empresas, emprendimientos o negocios)-B2B.;Gobierno o entidades públicas (Vendes a alcaldías, instituciones públicas o entidades del Estado)-B2G.",
                  "EvidenciaInteresSolucion": "Todavía no tengo ninguna evidencia formal.",
                  "EvidenciaInteresOtro": "",
                  "ConocimientoCompetencia": "Creo que no existe competencia directa para lo que hago.",
                  "EstimacionMercado": "He calculado TAM, SAM y SOM con fuentes y supuestos documentados.",
                  "AlcanceGeografico": "Principales ciudades de Colombia.",
                  "PropuestaValor": "Para la comunidad sorda colombiana, HandTalk Bot desarrolla tecnología basada en inteligencia artificial para reconocer la Lengua de Señas Colombiana mediante visión artificial. Nuestra diferencia radica en que no solo buscamos traducir señas, sino crear la base tecnológica para futuras aplicaciones en robots y sistemas inteligentes, contribuyendo a cerrar la brecha de investigación e innovación existente en Colombia.",
                  "ClaridadValor": "La tengo estructurada",
                  "DiferenciaCompetencia": "Aún no hemos identificado un factor diferenciador claro.",
                  "SectorProductivo": "Inteligencia artificial y computación avanzada",
                  "ModeloIngresos": "Todavía no he pensado cómo voy a generar ingresos.",
                  "Canales": "Todavía no he pensado en canales.",
                  "AliadosEstrategicos": "Todavía no tengo aliados formales.",
                  "TieneVentas": "No",
                  "FacturacionTotal": "",
                  "PromedioVentasMensual3M": "",
                  "PuntoEquilibrio": "",
                  "RegistrosContablesDisponibles": "",
                  "EstadoProteccionPI": "Todavía no he pensado en proteger la PI.",
                  "TipoProteccionPI": "Todavía no aplicamos ninguno.",
                  "DuenoLegalPI": "Todavía no está definida la titularidad.",
                  "LibertadOperacion": "No he considerado ese tema.",
                  "RolesEquipoCubiertos": "Investigador principal con dominio técnico-científico. ;Co-investigador técnico que complementa al principal. ;Responsable de negocio o desarrollo comercial (alguien que piensa en cliente, ventas, modelo).",
                  "ExperienciaEmprendimientoTransferencia": "Ninguno tiene experiencia previa.",
                  "DedicacionEquipo": "Entre 5 y 8 horas por semana.",
                  "DisponibilidadTiempoCompleto": "No, todos seguiremos en dedicación parcial.",
                  "MujeresEquipo": "2",
                  "BonoEquidadAplica": true,
                  "JustificacionEquipoMercado": "Somos un equipo interdisciplinario conformado por estudiantes de Ingeniería de Sistemas e Ingeniería Mecatrónica con experiencia en inteligencia artificial, visión artificial, análisis de datos, desarrollo de software y sistemas robóticos. A diferencia de otros equipos, no solo identificamos una problemática, sino que desarrollamos un prototipo funcional de reconocimiento de Lengua de Señas Colombiana y realizamos una investigación exhaustiva sobre el estado del arte nacional e internacional.  Además, comprendemos una de las principales barreras del sector: la escasez de datasets y tecnologías especializadas para la LSC en Colombia. Nuestro trabajo nos ha permitido adquirir conocimiento técnico específico difícil de replicar en procesamiento de datos, entrenamiento de modelos y análisis de tecnologías emergentes como Transformers y sistemas Multi-Cue para interacción humano-robot.  Contamos con el respaldo académico de la Universidad EAN y una visión clara para transformar esta investigación en una tecnología inclusiva con impacto social y potencial de transferencia al mercado.",
                  "InversionAcumulada": "Menos de 10 millones de COP.",
                  "FuentesInversion": "Recursos propios del equipo o familia (FFF).",
                  "NecesidadFinanciera12Meses": "Todavía no lo he estimado.",
                  "RecursosOperacion6Meses": "No.",
                  "BuscaInversion": "No, por ahora no es una prioridad.",
                  "EstadoLegal": "Todavía no he pensado en constituir empresa.",
                  "VerticalSostenibilidad": "IA y Tecnologías Emergentes. ;Diversidades y equidad.",
                  "ODSRelacionados": "ODS 4: Educación de calidad;ODS 10: Reducción de las desigualdades;ODS 9: Industria, innovación e infraestructura",
                  "MideImpacto": "Todavía no hemos definido métricas de impacto.",
                  "RequiereRegulacion": "No requiere autorizaciones específicas.",
                  "EstadoTramitesRegulatorios": "No aplica (no requiere autorizaciones).",
                  "VideoPitchURL": "https://example.com/s2v-2026-010/video-pitch",
                  "URLAnexo1": "https://example.com/s2v-2026-010/anexo1",
                  "RetoPrograma": "El principal reto que buscamos resolver mediante el acompañamiento de Science2Venture es acelerar la evolución de nuestro prototipo actual hacia una solución con potencial de transferencia tecnológica y aplicación real. En particular, necesitamos fortalecer tres aspectos clave: la obtención y construcción de datasets más robustos y representativos de la Lengua de Señas Colombiana, la incorporación de arquitecturas avanzadas de inteligencia artificial como Transformers y modelos Multi-Cue para el reconocimiento de señas dinámicas, y la validación de la tecnología en entornos de robótica e interacción humano-robot.  Además, buscamos orientación para identificar aliados estratégicos, oportunidades de validación con usuarios finales y posibles rutas de escalamiento que permitan convertir la investigación desarrollada en una solución innovadora con impacto social y potencial de mercado.",
                  "EstadoPostulacion": "Recibida",
                  "CoherenciaTRLPreliminar": "Pendiente de revisión"
            },
            {
                  "IDOriginal": "12",
                  "IDIniciativa": "S2V-2026-011",
                  "NombreIniciativa": "Animal&Human foods",
                  "NombreLider": "Julian Jimenez Ruiz",
                  "CorreoLider": "j***8@universidadean.edu.co",
                  "Ciudad": "Bogota",
                  "VinculacionLider": "Estudiante",
                  "FacultadArea": "",
                  "RolIniciativa": "Investigador",
                  "SurgeGrupoSemillero": "Sí, de un semillero",
                  "GrupoOSemillero": "semillero de investigación es Industria y Productividad Ean",
                  "AreaConocimiento": "Ingeniería y tecnología",
                  "EnfoqueProyecto": "Base científica",
                  "DescripcionCorta": "Animal&Human Foods desarrolla batidos nutricionales liofilizados enriquecidos con probióticos y frutas naturales, diseñados para apoyar la recuperación nutricional y la salud intestinal de personas con riesgo de desnutrición, pérdida de masa muscular o procesos de recuperación física.  Nuestro proyecto utiliza tecnología de liofilización para conservar nutrientes, microorganismos benéficos y compuestos funcionales sin necesidad de refrigeración, facilitando su almacenamiento, transporte y consumo. El producto se prepara de forma instantánea al mezclarlo con agua o leche.  Buscamos responder a la necesidad de alternativas nutritivas, prácticas y de larga vida útil para poblaciones vulnerables, especialmente adultos mayores y personas en recuperación. El impacto esperado es mejorar el acceso a una nutrición de calidad, promover el bienestar digestivo y contribuir a una mejor calidad de vida mediante soluciones alimentarias basadas en ciencia y tecnología.",
                  "PosturaEquityEan": "Si estoy de acuerdo con que la Universidad tenga participación.",
                  "AnioInicioTecnologia": "2022",
                  "TRLDeclarado": "TRL 6 Demostración en entorno de trabajo",
                  "TRLNum": 6,
                  "RutaTRL": "TRL 4-6",
                  "CRLDeclarado": "CRL 7 Validación del modelo financiero",
                  "CRLNum": 7,
                  "BRLDeclarado": "BRL 7 Retroalimentación",
                  "BRLNum": 7,
                  "EvidenciasTRL": "Tesis de pregrado, maestría o doctorado vinculada al proyecto. ;Prototipo físico o digital con fotos o videos que lo muestren funcionando. ;Reporte técnico interno con resultados experimentales documentados.",
                  "EntornoPruebaTecnologia": "En entorno real, pero en modo piloto o prueba con un cliente o aliado.",
                  "BrechaTecnicaPrincipal": "Asegurar que el prototipo sea confiable, reproducible y dure lo suficiente para ser usado.",
                  "TipoTecnologia": "Mi proyecto es Deep Tech",
                  "OrigenTecnologia": "Una parte la desarrollamos internamente; otra parte se apoya en herramientas existentes.",
                  "ComplejidadTecnica": "Muy alto (Deep Tech)",
                  "EvidenciasDocumentadas": "Sí, cuento con evidencias documentadas que pueden ser revisadas en esta convocatoria.",
                  "EvidenciasURL": "https://example.com/s2v-2026-011/evidencias",
                  "OrigenProblema": "Identificamos el problema leyendo literatura académica, reportes del sector o noticias.",
                  "DescripcionProblema": "Muchas personas en procesos de recuperación física, adultos mayores y personas con riesgo de desnutrición tienen dificultades para acceder a alimentos que sean al mismo tiempo nutritivos, fáciles de preparar y estables durante largos periodos de almacenamiento. Esta situación puede afectar su recuperación, bienestar digestivo y calidad de vida. Además, muchos suplementos nutricionales disponibles requieren refrigeración, tienen baja aceptación por sabor o presentan pérdida de propiedades durante el almacenamiento. Nuestro proyecto busca solucionar este problema mediante un batido nutricional liofilizado enriquecido con probióticos y frutas naturales, que conserva sus propiedades nutricionales y funcionales, es fácil de transportar y puede prepararse de forma instantánea. De esta manera, contribuimos a mejorar el acceso a una nutrición práctica, segura y de alta calidad para poblaciones que requieren apoyo nutricional especializado.",
                  "ValidacionProblema": "Revisé literatura académica y reportes sectoriales que describen el problema.;Hice entrevistas informales con personas que podrían ser usuarios o clientes. ;Tengo estudios previos propios o de terceros que respaldan la existencia del problema.",
                  "PersonasEntrevistadas": "Más de 30 personas.",
                  "ResultadoConversaciones": "Ajustamos la propuesta de valor (lo que ofrecemos o cómo lo presentamos).",
                  "TipoClientePrincipal": "Consumidor final (Vendes directamente a personas para uso personal)-B2C.;Empresas o negocios (Vendes a empresas, emprendimientos o negocios)-B2B.;Gobierno o entidades públicas (Vendes a alcaldías, instituciones públicas o entidades del Estado)-B2G.",
                  "EvidenciaInteresSolucion": "Personas me han dicho verbalmente que les parece buena idea. ;Hay pilotos no pagados en curso o ya completados. ;Otro",
                  "EvidenciaInteresOtro": "El interés en la solución se evidencia a través de la experiencia comercial previa del equipo con productos liofilizados, la participación en procesos de incubación empresarial, validaciones realizadas con potenciales consumidores durante ferias y eventos de emprendimiento, así como el respaldo obtenido mediante la adjudicación de recursos de Fondo Emprender para el fortalecimiento de capacidades productivas relacionadas con esta línea tecnológica.",
                  "ConocimientoCompetencia": "He mapeado a mis competidores directos y sé qué ofrecen.",
                  "EstimacionMercado": "He calculado TAM y SAM con fuentes citables.",
                  "AlcanceGeografico": "Varios países (internacional).",
                  "PropuestaValor": "Para adultos mayores y personas en procesos de recuperación nutricional, desarrollamos un batido liofilizado enriquecido con probióticos y frutas naturales que aporta nutrición de alta calidad, favorece la salud intestinal y puede almacenarse sin refrigeración. Nuestra tecnología de liofilización permite conservar nutrientes y microorganismos benéficos, ofreciendo una alternativa práctica, estable y de larga vida útil frente a los suplementos convencionales.",
                  "ClaridadValor": "Está estructurada y la he validado con al menos 5 clientes potenciales.",
                  "DiferenciaCompetencia": "Contamos con know-how o conocimiento especializado difícil de replicar.;Tenemos acceso a infraestructura, laboratorios o alianzas estratégicas.;Tenemos una marca o posicionamiento temprano en el mercado.",
                  "SectorProductivo": "Farmacéutico y biotecnología;Industria de alimentos y bebidas;Ciencias de la vida (salud, genómica, bioinformática)",
                  "ModeloIngresos": "Combinación de varios de los anteriores.",
                  "Canales": "Distribuidores o representantes en Colombia que venden por nosotros.",
                  "AliadosEstrategicos": "Tengo una red activa de 3 o más aliados formalmente vinculados.",
                  "TieneVentas": "Sí",
                  "FacturacionTotal": "30000000",
                  "PromedioVentasMensual3M": "1500000",
                  "PuntoEquilibrio": "Estoy cerca",
                  "RegistrosContablesDisponibles": "Llevamos registros básicos informales (una hoja de Excel, apuntes).",
                  "EstadoProteccionPI": "He hecho un análisis preliminar pero no tenemos protección formal aún.",
                  "TipoProteccionPI": "Patente de invención.",
                  "DuenoLegalPI": "Todavía no está definida la titularidad.",
                  "LibertadOperacion": "He hecho un análisis preliminar con búsqueda básica en bases de patentes.",
                  "RolesEquipoCubiertos": "Co-investigador técnico que complementa al principal. ;Investigador principal con dominio técnico-científico. ;Responsable de negocio o desarrollo comercial (alguien que piensa en cliente, ventas, modelo). ;Responsable de comunicación y relación con el ecosistema. ;Responsable financiero u operaciones.",
                  "ExperienciaEmprendimientoTransferencia": "Alguien creó y operó una empresa exitosa.",
                  "DedicacionEquipo": "Tiempo completo.",
                  "DisponibilidadTiempoCompleto": "Sí, hay al menos una persona comprometida a hacerlo.",
                  "MujeresEquipo": "2",
                  "BonoEquidadAplica": true,
                  "JustificacionEquipoMercado": "Nuestro equipo combina experiencia en investigación aplicada, desarrollo de productos alimentarios, emprendimiento y validación comercial. Durante los últimos tres años hemos trabajado en tecnologías de liofilización y deshidratación aplicadas a alimentos para consumo humano y animal, desarrollando productos propios y validándolos en el mercado. Además, hemos participado en procesos de incubación empresarial, eventos de innovación y fortalecimiento empresarial, lo que nos ha permitido entender tanto los desafíos técnicos como las necesidades reales de los clientes.  Contamos con experiencia en la formulación de alimentos funcionales, conocimiento de procesos productivos y acceso a redes académicas y empresariales construidas a través de la Universidad EAN, el semillero de investigación Industria y Productividad y programas de apoyo al emprendimiento. Esta combinación de capacidades técnicas, comerciales y de ejecución nos permite transformar resultados de investigación en soluciones con potencial de mercado e impacto real.",
                  "InversionAcumulada": "Entre 50 y 200 millones.",
                  "FuentesInversion": "Recursos propios del equipo o familia (FFF). ;Empresas aliadas (contratos o patrocinios).;Inversionistas ángeles o venture capital.",
                  "NecesidadFinanciera12Meses": "Entre 70 y 300 millones.",
                  "RecursosOperacion6Meses": "Sí, pero ajustado (entre 50% y 80%).",
                  "BuscaInversion": "Sí, estamos en etapa de preparación (deck, proyecciones, pitch).",
                  "EstadoLegal": "Estoy evaluando qué figura jurídica sería la adecuada (SAS, Ltda, etc.).",
                  "VerticalSostenibilidad": "Salud y biotecnología.;Seguridad alimentaria.",
                  "ODSRelacionados": "ODS 2: Hambre cero;ODS 3: Salud y bienestar;ODS 9: Industria, innovación e infraestructura",
                  "MideImpacto": "Tenemos métricas cualitativas generales (sin números).",
                  "RequiereRegulacion": "INVIMA (medicamentos, alimentos, dispositivos médicos, cosméticos).",
                  "EstadoTramitesRegulatorios": "Estamos preparando los documentos.",
                  "VideoPitchURL": "https://example.com/s2v-2026-011/video-pitch",
                  "URLAnexo1": "https://example.com/s2v-2026-011/anexo1",
                  "RetoPrograma": "Nuestro principal reto es fortalecer la validación científica, tecnológica y comercial de la formulación de batidos nutricionales liofilizados enriquecidos con probióticos, con el fin de convertir este desarrollo en una tecnología transferible y escalable. Buscamos validar la estabilidad de los microorganismos probióticos, optimizar la formulación y generar evidencia técnica que respalde su efectividad y diferenciación frente a las alternativas existentes.  Adicionalmente, queremos estructurar una estrategia sólida de propiedad intelectual, escalamiento productivo y modelo de negocio que nos permita avanzar hacia la creación de una spin-off de base científico-tecnológica con potencial de impacto nacional e internacional en los sectores de salud, nutrición y seguridad alimentaria.",
                  "EstadoPostulacion": "Recibida",
                  "CoherenciaTRLPreliminar": "Pendiente de revisión"
            },
            {
                  "IDOriginal": "13",
                  "IDIniciativa": "S2V-2026-012",
                  "NombreIniciativa": "Agente Hermes",
                  "NombreLider": "Julio César Rodríguez Cristancho",
                  "CorreoLider": "n***z@gmail.com",
                  "Ciudad": "Yopal",
                  "VinculacionLider": "Estudiante",
                  "FacultadArea": "",
                  "RolIniciativa": "Fundador",
                  "SurgeGrupoSemillero": "No",
                  "GrupoOSemillero": "",
                  "AreaConocimiento": "Ingeniería y tecnología",
                  "EnfoqueProyecto": "Digital",
                  "DescripcionCorta": "Poner al alcance de cualquier persona y agente personal que funcione 24h para poder mejorar los resultados y la velocidad de ellos de los diferentes proyectos en su vida.",
                  "PosturaEquityEan": "No estoy de acuerdo con que la Universidad tenga participación.",
                  "AnioInicioTecnologia": "2026",
                  "TRLDeclarado": "TRL 9 Despliegue comercial",
                  "TRLNum": 9,
                  "RutaTRL": "TRL 7-9",
                  "CRLDeclarado": "CRL 8 Introducción al mercado",
                  "CRLNum": 8,
                  "BRLDeclarado": "BRL 7 Retroalimentación",
                  "BRLNum": 7,
                  "EvidenciasTRL": "Prototipo físico o digital con fotos o videos que lo muestren funcionando.",
                  "EntornoPruebaTecnologia": "En entorno real, pero en modo piloto o prueba con un cliente o aliado.",
                  "BrechaTecnicaPrincipal": "No hay brechas técnicas pendientes; la tecnología está lista para escalar.",
                  "TipoTecnologia": "Uso tecnologías avanzadas existentes (IA comercial, software especializado, analítica avanzada).",
                  "OrigenTecnologia": "Adaptamos o personalizamos tecnologías existentes para nuestras necesidades.",
                  "ComplejidadTecnica": "Alto",
                  "EvidenciasDocumentadas": "No cuento todavía con evidencias documentadas del avance técnico.",
                  "EvidenciasURL": "",
                  "OrigenProblema": "Partimos de una tecnología o hallazgo científico interesante y estamos buscando dónde aplicarla.",
                  "DescripcionProblema": "Resuelvo primero las barreras de entrada de las personas que usan IA pero no llegan a automatizar procesos y no saben cómo integrarla a su vida de forma facil.",
                  "ValidacionProblema": "Hice pruebas piloto con la solución real (aunque sea versión básica) con usuarios. ;Un cliente o aliado está pagando o pilotando la solución hoy.",
                  "PersonasEntrevistadas": "Entre 6 y 15 personas.",
                  "ResultadoConversaciones": "Ajustamos la propuesta de valor (lo que ofrecemos o cómo lo presentamos).",
                  "TipoClientePrincipal": "Consumidor final (Vendes directamente a personas para uso personal)-B2C.",
                  "EvidenciaInteresSolucion": "Hay pilotos pagados en curso o ya completados.",
                  "EvidenciaInteresOtro": "",
                  "ConocimientoCompetencia": "No he investigado quién es mi competencia ni cómo se resuelve hoy el problema.",
                  "EstimacionMercado": "Todavía no lo he estimado.",
                  "AlcanceGeografico": "Varios países (internacional).",
                  "PropuestaValor": "Es para cualquier persona que no tenga flujos de trabajos automotaizados y que sus empleados no sean capaces de darle solución a cabalidad, es muy fácil de utilizar y en constante mejora",
                  "ClaridadValor": "La tengo en una frase general, pero sin estructura.",
                  "DiferenciaCompetencia": "Aún no hemos identificado un factor diferenciador claro.",
                  "SectorProductivo": "Inteligencia artificial y computación avanzada",
                  "ModeloIngresos": "Suscripción o membresía (el cliente paga mensual o anualmente).",
                  "Canales": "Plataforma digital o e-commerce propio.",
                  "AliadosEstrategicos": "Todavía no tengo aliados formales.",
                  "TieneVentas": "Sí",
                  "FacturacionTotal": "800000",
                  "PromedioVentasMensual3M": "400000",
                  "PuntoEquilibrio": "Sí, alcanzamos el punto de equilibrio recientemente.",
                  "RegistrosContablesDisponibles": "Todavía no llevamos ningún registro formal.",
                  "EstadoProteccionPI": "Todavía no he pensado en proteger la PI.",
                  "TipoProteccionPI": "Todavía no aplicamos ninguno.",
                  "DuenoLegalPI": "Un tercero externo (Minciencias, empresa que contrató la investigación, etc.).",
                  "LibertadOperacion": "No he considerado ese tema.",
                  "RolesEquipoCubiertos": "Investigador principal con dominio técnico-científico.",
                  "ExperienciaEmprendimientoTransferencia": "Alguien creó una empresa previamente, aunque no haya prosperado.",
                  "DedicacionEquipo": "Entre 5 y 8 horas por semana.",
                  "DisponibilidadTiempoCompleto": "Sí, hay al menos una persona comprometida a hacerlo.",
                  "MujeresEquipo": "0",
                  "BonoEquidadAplica": false,
                  "JustificacionEquipoMercado": "Tengo experiencia ya con emprendimientos se crear contenido y como tratar clientes, además ya atiendo clientes actualmente muy felices y están dispuestos a seguir inclusive pagando más.",
                  "InversionAcumulada": "Menos de 10 millones de COP.",
                  "FuentesInversion": "Recursos propios del equipo o familia (FFF).",
                  "NecesidadFinanciera12Meses": "Todavía no lo he estimado.",
                  "RecursosOperacion6Meses": "Sí, pero ajustado (entre 50% y 80%).",
                  "BuscaInversion": "No, por ahora no es una prioridad.",
                  "EstadoLegal": "Todavía no he pensado en constituir empresa.",
                  "VerticalSostenibilidad": "IA y Tecnologías Emergentes.",
                  "ODSRelacionados": "ODS 9: Industria, innovación e infraestructura",
                  "MideImpacto": "Todavía no hemos definido métricas de impacto.",
                  "RequiereRegulacion": "No requiere autorizaciones específicas.",
                  "EstadoTramitesRegulatorios": "No aplica (no requiere autorizaciones).",
                  "VideoPitchURL": "https://example.com/s2v-2026-012/video-pitch",
                  "URLAnexo1": "https://example.com/s2v-2026-012/anexo1",
                  "RetoPrograma": "Guia en procesos de formalización de empresa, exposición a inversores",
                  "EstadoPostulacion": "Recibida",
                  "CoherenciaTRLPreliminar": "Pendiente de revisión"
            },
            {
                  "IDOriginal": "14",
                  "IDIniciativa": "S2V-2026-013",
                  "NombreIniciativa": "Biomuseo Nacional del Queso: Matrices poliméricas solubles y coagulantes nativos para la soberanía de la quesería artesanal.",
                  "NombreLider": "Yudy Astrid Pulido Castillo",
                  "CorreoLider": "y***d@gmail.com",
                  "Ciudad": "Anolaima Cundinamarca",
                  "VinculacionLider": "Graduado",
                  "FacultadArea": "",
                  "RolIniciativa": "Investigadora y gestora",
                  "SurgeGrupoSemillero": "No",
                  "GrupoOSemillero": "",
                  "AreaConocimiento": "Ciencias agrícolas",
                  "EnfoqueProyecto": "Mixto",
                  "DescripcionCorta": "Biomuseo Nacional del Queso es una iniciativa mixta (digital y biotecnológica) que revoluciona el sector lácteo artesanal colombiano mediante un modelo de economía circular Zero Waste. El proyecto transforma el lactosuero —un subproducto altamente contaminante de la ricotta y el yogur griego— en la materia prima para codiseñar y fabricar matrices poliméricas solubles y biodegradables.  Estas matrices encapsulan, dosifican y conservan microorganismos lácticos nativos y cuajos de autor en estado de latencia, haciéndolos estables a temperatura ambiente y optimizando su logística.  Problema que resuelve: Elimina la dependencia absoluta de cultivos químicos industriales importados, salvaguardando la identidad sensorial y la biodiversidad microbiana del territorio.  Impacto: Garantiza la soberanía alimentaria, reduce la huella ambiental en entornos rurales y genera un bionegocio altamente rentable que añade valor premium a la quesería nacional bajo la filosofía Slow Food.",
                  "PosturaEquityEan": "Si estoy de acuerdo con que la Universidad tenga participación.",
                  "AnioInicioTecnologia": "2023",
                  "TRLDeclarado": "TRL 4 Prueba experimental de concepto",
                  "TRLNum": 4,
                  "RutaTRL": "TRL 4-6",
                  "CRLDeclarado": "CRL 6 Optimización de productos/soluciones",
                  "CRLNum": 6,
                  "BRLDeclarado": "BRL 6 Producto mínimo viable",
                  "BRLNum": 6,
                  "EvidenciasTRL": "Ponencia o presentación en evento científico o tecnológico. ;Reporte técnico interno con resultados experimentales documentados. ;Prototipo físico o digital con fotos o videos que lo muestren funcionando.",
                  "EntornoPruebaTecnologia": "En entorno real, pero en modo piloto o prueba con un cliente o aliado.",
                  "BrechaTecnicaPrincipal": "Asegurar que el prototipo sea confiable, reproducible y dure lo suficiente para ser usado.",
                  "TipoTecnologia": "Mi proyecto es Deep Tech",
                  "OrigenTecnologia": "Una parte la desarrollamos internamente; otra parte se apoya en herramientas existentes.",
                  "ComplejidadTecnica": "Muy alto (Deep Tech)",
                  "EvidenciasDocumentadas": "Sí, cuento con evidencias documentadas que pueden ser revisadas en esta convocatoria.",
                  "EvidenciasURL": "https://example.com/s2v-2026-013/evidencias",
                  "OrigenProblema": "Identificamos el problema por experiencia directa de alguien del equipo en ese sector.",
                  "DescripcionProblema": "El problema central es la pérdida de identidad y competitividad en la quesería artesanal debido a la falta de estandarización en sus procesos. Al depender de la volatilidad climática y de microfloras ambientales sin estabilizar, los productores rurales enfrentan variaciones críticas que alteran el perfil de sabor, aroma y textura de sus productos, traduciéndose en pérdidas frecuentes de hasta el 20% de la producción por lotes defectuosos y destruyendo su rentabilidad. Las soluciones comerciales actuales homogenizan el producto con insumos genéricos que borran el valor del terruño. Este proyecto resuelve esa brecha técnica mediante plataformas biotecnológicas que estabilizan los consorcios biológicos nativos a temperatura ambiente. Utilizando el análisis sensorial como herramienta de control y validación científica, logramos predecir y replicar los atributos únicos del territorio, transformando un riesgo técnico en un proceso seguro, reproducible y escalable que blinda el campo sin sacrificar su autenticidad.",
                  "ValidacionProblema": "Revisé literatura académica y reportes sectoriales que describen el problema.;Hice pruebas piloto con la solución real (aunque sea versión básica) con usuarios. ;Tengo estudios previos propios o de terceros que respaldan la existencia del problema.",
                  "PersonasEntrevistadas": "Más de 30 personas.",
                  "ResultadoConversaciones": "Ajustamos la propuesta de valor (lo que ofrecemos o cómo lo presentamos).",
                  "TipoClientePrincipal": "Empresas o negocios (Vendes a empresas, emprendimientos o negocios)-B2B.",
                  "EvidenciaInteresSolucion": "Personas me han dicho verbalmente que les parece buena idea. ;Hay pilotos no pagados en curso o ya completados.",
                  "EvidenciaInteresOtro": "",
                  "ConocimientoCompetencia": "He mapeado a mis competidores directos y sé qué ofrecen.",
                  "EstimacionMercado": "He calculado el TAM (mercado total) con datos secundarios.",
                  "AlcanceGeografico": "Todo el territorio nacional.",
                  "PropuestaValor": "Para queseros artesanales que pierden producción por el clima, creamos bioinsumos que estabilizan los fermentos nativos a temperatura ambiente. A diferencia de los químicos industriales, usamos ciencia sensorial para replicar la identidad única del territorio, salvando su rentabilidad, 100% Colombiano.",
                  "ClaridadValor": "Está estructurada, validada y ajustada varias veces con base en lo aprendido del mercado.",
                  "DiferenciaCompetencia": "Contamos con know-how o conocimiento especializado difícil de replicar.;Tenemos acceso a datos propios o información diferenciadora.;Nuestra comunidad o red de usuarios fortalece el crecimiento de la iniciativa.",
                  "SectorProductivo": "Industria de alimentos y bebidas;Agroindustria y agroalimentario;Economía verde y circular (sostenibilidad, reciclaje, carbono neutro)",
                  "ModeloIngresos": "Combinación de varios de los anteriores.",
                  "Canales": "Venta directa por parte del equipo fundador (nosotros mismos vendemos).",
                  "AliadosEstrategicos": "Estoy en conversaciones informales con posibles aliados.",
                  "TieneVentas": "No",
                  "FacturacionTotal": "",
                  "PromedioVentasMensual3M": "",
                  "PuntoEquilibrio": "",
                  "RegistrosContablesDisponibles": "",
                  "EstadoProteccionPI": "He hecho un análisis preliminar pero no tenemos protección formal aún.",
                  "TipoProteccionPI": "Secreto industrial documentado.",
                  "DuenoLegalPI": "Todavía no está definida la titularidad.",
                  "LibertadOperacion": "He hecho un análisis preliminar con búsqueda básica en bases de patentes.",
                  "RolesEquipoCubiertos": "Investigador principal con dominio técnico-científico. ;Responsable de negocio o desarrollo comercial (alguien que piensa en cliente, ventas, modelo). ;Responsable de comunicación y relación con el ecosistema.",
                  "ExperienciaEmprendimientoTransferencia": "Alguien creó una empresa previamente, aunque no haya prosperado.",
                  "DedicacionEquipo": "Tiempo completo.",
                  "DisponibilidadTiempoCompleto": "Ya hay alguien dedicado tiempo completo al proyecto hoy.",
                  "MujeresEquipo": "2",
                  "BonoEquidadAplica": true,
                  "JustificacionEquipoMercado": "Somos las personas indicadas porque este proyecto no nace de una simulación académica, sino de la convergencia exacta entre rigor científico-investigativo y tracción real en el mercado rural colombiano.  Las tres razones que nos hacen únicos frente a cualquier competidor son:  1. Dominio Técnico y Respaldo Científico del Territorio Contamos con el conocimiento especializado para aislar, estandarizar y estabilizar microflora nativa y sistemas de fermentación basados en entornos locales, sin depender de cepas comerciales importadas. Este know-how está respaldado por años de investigación de campo y la autoría del manuscrito técnico \"Quesos de Montaña: Manual de Cultivos Nativos y Flora Láctica Colombiana en Leche Cruda\". No solo entendemos la microbiología del territorio; la estamos documentando y transformando en bioinsumos reproducibles.  2. Validación de Mercado y Tracción Comercial Real A diferencia de proyectos de laboratorio que buscan cómo salir al mercado, nosotros ya estamos en él. Con nuestra marca de quesos de autor, hemos validado la tecnología directamente con el consumidor final. Entendemos el comportamiento del cliente y los retos logísticos de la cadena láctea porque los operamos diariamente.  3. Conexiones y Reconocimiento en el Ecosistema Lácteo Poseemos un posicionamiento y una red de contactos única en el sector. Mi experiencia como jurado internacional de quesos y divulgadores de la lactografía colombiana nos otorga la credibilidad necesaria para articular la triple hélice: academia, pequeños productores rurales y el mercado de alta gama. Esta autoridad en el sector facilita la apertura de canales B2B y la construcción de alianzas estratégicas con asociaciones lácteas que otros equipos tardarían años en consolidar.",
                  "InversionAcumulada": "Entre 10 y 50 millones.",
                  "FuentesInversion": "Recursos propios del equipo o familia (FFF).",
                  "NecesidadFinanciera12Meses": "Entre 20 y 70 millones.",
                  "RecursosOperacion6Meses": "Sí, pero ajustado (entre 50% y 80%).",
                  "BuscaInversion": "Sí, estamos en etapa de preparación (deck, proyecciones, pitch).",
                  "EstadoLegal": "Empresa constituida legalmente y con RUT.",
                  "VerticalSostenibilidad": "Agrotecnología y desarrollo rural. ;Soluciones basadas en la naturaleza y bionegocios.",
                  "ODSRelacionados": "ODS 8: Trabajo decente y crecimiento económico;ODS 12: Producción y consumo responsables;ODS 15: Vida de ecosistemas terrestres",
                  "MideImpacto": "Hemos medido el impacto en pilotos o escenarios controlados.",
                  "RequiereRegulacion": "INVIMA (medicamentos, alimentos, dispositivos médicos, cosméticos).;ICA (agroinsumos, sanidad animal o vegetal).",
                  "EstadoTramitesRegulatorios": "No hemos iniciado los trámites.",
                  "VideoPitchURL": "https://example.com/s2v-2026-013/video-pitch",
                  "URLAnexo1": "https://example.com/s2v-2026-013/anexo1",
                  "RetoPrograma": "El reto principal que quiero resolver en el programa es diseñar el modelo de transferencia y el esquema legal para escalar de un taller de producción artesanal a una plataforma biotecnológica de bioinsumos lácteos basada en microflora nativa.  Actualmente, el bionegocio opera de manera exitosa a nivel piloto (BRL 6) en Anolaima, logrando la validación comercial directa de quesos de autor. Sin embargo, el obstáculo más urgente no es aumentar el volumen de producción de quesos, sino estructurar el \"Know-how\" y el Secreto Industrial de los protocolos de aislamiento y fermentación.",
                  "EstadoPostulacion": "Recibida",
                  "CoherenciaTRLPreliminar": "Pendiente de revisión"
            },
            {
                  "IDOriginal": "15",
                  "IDIniciativa": "S2V-2026-014",
                  "NombreIniciativa": "CardioBio: Prevención de falla cardíaca mediante bioimpedancia.",
                  "NombreLider": "ANGELA SOFIA LADINO MARSIGLIA",
                  "CorreoLider": "A***8@UNIVERSIDADEAN.EDU.CO",
                  "Ciudad": "BOGOTA",
                  "VinculacionLider": "Estudiante",
                  "FacultadArea": "",
                  "RolIniciativa": "INVESTIGADOR",
                  "SurgeGrupoSemillero": "Sí, de un semillero",
                  "GrupoOSemillero": "ONTARE",
                  "AreaConocimiento": "Ciencias médicas y de la salud",
                  "EnfoqueProyecto": "Producto",
                  "DescripcionCorta": "Identifica la retención de líquidos de manera temprana y predictiva días antes de que aparezcan síntomas graves. Esto permite la intervención médica remota y el ajuste oportuno del tratamiento, transformando la atención reactiva en prevención real. Su impacto radica en reducir drásticamente las rehospitalizaciones, optimizar los costos del sistema de salud y salvar vidas mediante telemonitoreo continuo.",
                  "PosturaEquityEan": "Si estoy de acuerdo con que la Universidad tenga participación.",
                  "AnioInicioTecnologia": "2025",
                  "TRLDeclarado": "TRL 3 Validación en laboratorio",
                  "TRLNum": 3,
                  "RutaTRL": "TRL 1-3",
                  "CRLDeclarado": "CRL 1 Hipótesis",
                  "CRLNum": 1,
                  "BRLDeclarado": "BRL 2 Ajuste problema–solución",
                  "BRLNum": 2,
                  "EvidenciasTRL": "Ponencia o presentación en evento científico o tecnológico.",
                  "EntornoPruebaTecnologia": "Solo en laboratorio controlado (universidad u otra institución)",
                  "BrechaTecnicaPrincipal": "Escalar el prototipo de laboratorio a condiciones reales (que funcione fuera del laboratorio).",
                  "TipoTecnologia": "Mi proyecto es Deep Tech",
                  "OrigenTecnologia": "Una parte la desarrollamos internamente; otra parte se apoya en herramientas existentes.",
                  "ComplejidadTecnica": "Medio",
                  "EvidenciasDocumentadas": "Estoy preparando la documentación, pero aún no cuento con soportes listos para revisión.",
                  "EvidenciasURL": "",
                  "OrigenProblema": "Identificamos el problema por experiencia directa de alguien del equipo en ese sector.",
                  "DescripcionProblema": "El problema lo viven los pacientes con Falla Cardíaca Crónica. Su complicación más frecuente es la descompensación por congestión (acumulación de líquidos), un fenómeno que ocurre de forma silenciosa y continua, desencadenando crisis clínicas varias veces al año.  Al no existir un monitoreo preventivo y preciso en el hogar, las consecuencias son graves: el paciente detecta el problema solo cuando experimenta síntomas severos",
                  "ValidacionProblema": "Revisé literatura académica y reportes sectoriales que describen el problema.;Tengo estudios previos propios o de terceros que respaldan la existencia del problema.",
                  "PersonasEntrevistadas": "Entre 1 y 5 personas.",
                  "ResultadoConversaciones": "La idea se mantuvo igual; los usuarios confirmaron exactamente lo que pensábamos.",
                  "TipoClientePrincipal": "Consumidor final (Vendes directamente a personas para uso personal)-B2C.;Empresas o negocios (Vendes a empresas, emprendimientos o negocios)-B2B.",
                  "EvidenciaInteresSolucion": "Personas me han dicho verbalmente que les parece buena idea.",
                  "EvidenciaInteresOtro": "",
                  "ConocimientoCompetencia": "He identificado algunas soluciones alternativas o sustitutas.",
                  "EstimacionMercado": "Tengo una idea general, pero sin números respaldados por fuentes.",
                  "AlcanceGeografico": "Todo el territorio nacional.",
                  "PropuestaValor": "Para pacientes con falla cardíaca crónica que sufren rehospitalizaciones recurrentes por acumulación silenciosa de líquidos, nuestro sistema IoT de bioimpedancia detecta la congestión de forma ultra-temprana en el hogar. Esto permite una intervención médica oportuna antes de que aparezcan síntomas graves, reduciendo drásticamente los reingresos de urgencia y optimizando los costos del sistema de salud.",
                  "ClaridadValor": "La tengo estructurada",
                  "DiferenciaCompetencia": "Tenemos acceso a datos propios o información diferenciadora.;Tenemos acceso a infraestructura, laboratorios o alianzas estratégicas.",
                  "SectorProductivo": "Ciencias de la vida (salud, genómica, bioinformática)",
                  "ModeloIngresos": "Servicios asociados (consultoría, implementación, mantenimiento).",
                  "Canales": "Marketplaces de terceros (Amazon, Mercado Libre, plataformas sectoriales).",
                  "AliadosEstrategicos": "Todavía no tengo aliados formales.",
                  "TieneVentas": "No",
                  "FacturacionTotal": "",
                  "PromedioVentasMensual3M": "",
                  "PuntoEquilibrio": "",
                  "RegistrosContablesDisponibles": "",
                  "EstadoProteccionPI": "Estamos preparando la solicitud de protección (patente, registro de software, etc.).",
                  "TipoProteccionPI": "Patente de invención.",
                  "DuenoLegalPI": "Todavía no está definida la titularidad.",
                  "LibertadOperacion": "He hecho una revisión informal (búsquedas rápidas en Google o bases de datos).",
                  "RolesEquipoCubiertos": "Investigador principal con dominio técnico-científico. ;Responsable de producto, UX o ingeniería aplicada.   TMRL",
                  "ExperienciaEmprendimientoTransferencia": "Alguien participó en programas formativos de emprendimiento (cursos, bootcamps).",
                  "DedicacionEquipo": "Entre 5 y 8 horas por semana.",
                  "DisponibilidadTiempoCompleto": "Sí, hay al menos una persona comprometida a hacerlo.",
                  "MujeresEquipo": "1",
                  "BonoEquidadAplica": true,
                  "JustificacionEquipoMercado": "Poseo una ventaja competitiva y poco común en el ecosistema MedTech: la convergencia directa entre el criterio médico-clínico y la ingeniería de hardware debido soy médico graduado y estoy estudiando Ingeniería Mecatrónica, fusionando la experiencia y la academia",
                  "InversionAcumulada": "Menos de 10 millones de COP.",
                  "FuentesInversion": "Recursos propios del equipo o familia (FFF).",
                  "NecesidadFinanciera12Meses": "Menos de 20 millones de COP.",
                  "RecursosOperacion6Meses": "Parcialmente (cubro menos del 50% de lo que necesito).",
                  "BuscaInversion": "Sí, estamos en etapa de preparación (deck, proyecciones, pitch).",
                  "EstadoLegal": "Estoy evaluando qué figura jurídica sería la adecuada (SAS, Ltda, etc.).",
                  "VerticalSostenibilidad": "DeepTech.",
                  "ODSRelacionados": "ODS 3: Salud y bienestar;ODS 17: Alianzas para lograr los objetivos ;ODS 9: Industria, innovación e infraestructura",
                  "MideImpacto": "Tenemos métricas cuantificables propuestas, pero aún no las medimos.",
                  "RequiereRegulacion": "INVIMA (medicamentos, alimentos, dispositivos médicos, cosméticos).",
                  "EstadoTramitesRegulatorios": "No hemos iniciado los trámites.",
                  "VideoPitchURL": "https://example.com/s2v-2026-014/video-pitch",
                  "URLAnexo1": "https://example.com/s2v-2026-014/anexo1",
                  "RetoPrograma": "Diseñar y ejecutar el plan de validación clínica y regulatoria necesario para certificar el dispositivo médico ante las autoridades sanitarias. A pesar de contar con la arquitectura tecnológica (hardware de bioimpedancia y procesamiento IoT), necesito acompañamiento especializado para definir la ruta regulatoria, validación con usuarios finales, pasar del entorno de laboratorio a una validación real con pacientes y tomadores de decisión. Además de la estructura de Spin-off para definir el modelo de negocio escalable que permita la transferencia efectiva de los resultados.",
                  "EstadoPostulacion": "Recibida",
                  "CoherenciaTRLPreliminar": "Pendiente de revisión"
            },
            {
                  "IDOriginal": "16",
                  "IDIniciativa": "S2V-2026-015",
                  "NombreIniciativa": "Re-Evolución Biomecánica: Bipedestadores Sostenibles y Centro Terapéutico Integral",
                  "NombreLider": "Maria Elena Capera Beltran",
                  "CorreoLider": "c***4@gmail.com",
                  "Ciudad": "Bogotá D.C",
                  "VinculacionLider": "Graduado",
                  "FacultadArea": "",
                  "RolIniciativa": "Lider-Investigadora y desarrolladora.",
                  "SurgeGrupoSemillero": "No",
                  "GrupoOSemillero": "",
                  "AreaConocimiento": "Combinación de varias áreas (interdisciplinar)",
                  "EnfoqueProyecto": "Ciencia aplicada",
                  "DescripcionCorta": "Nuestro proyecto une la salud y la ingeniería sostenible para democratizar la rehabilitación neurológica en Colombia.  ¿Qué problema resuelve? Actualmente, miles de familias de bajos recursos con personas con discapacidad no pueden acceder a terapias especializadas ni comprar un bipedestador comercial, ya que sus costos son sumamente elevados.  ¿Qué hace? Diseñamos y fabricamos bipedestadores modulares de alta resistencia utilizando materiales reciclados industriales (como madera plástica y reatas de seguridad), integrando este hardware a un modelo de servicios terapéuticos accesibles tipo IPS.  ¿Qué impacto genera? Transforma la calidad de vida de los pacientes mejorando su salud física y autonomía, reduce la carga económica y emocional de sus familias, y promueve la economía circular al convertir residuos en tecnología médica de alto impacto social.",
                  "PosturaEquityEan": "Si estoy de acuerdo con que la Universidad tenga participación.",
                  "AnioInicioTecnologia": "2025",
                  "TRLDeclarado": "TRL 2 Concepto de tecnología formulado",
                  "TRLNum": 2,
                  "RutaTRL": "TRL 1-3",
                  "CRLDeclarado": "CRL 2 Conocimiento del mercado",
                  "CRLNum": 2,
                  "BRLDeclarado": "BRL 2 Ajuste problema–solución",
                  "BRLNum": 2,
                  "EvidenciasTRL": "Todavía no tenemos evidencias documentadas.",
                  "EntornoPruebaTecnologia": "Todavía no la he probado físicamente (solo en papel, modelado o simulación).",
                  "BrechaTecnicaPrincipal": "Construir el primer prototipo integrado (combinar los componentes en un solo sistema).",
                  "TipoTecnologia": "Estoy creando tecnología propia como producto principal (software, IA entrenada, SaaS, API, hardware).",
                  "OrigenTecnologia": "Combinamos varias tecnologías existentes para crear algo nuevo que antes no existía así.",
                  "ComplejidadTecnica": "Alto",
                  "EvidenciasDocumentadas": "No cuento todavía con evidencias documentadas del avance técnico.",
                  "EvidenciasURL": "",
                  "OrigenProblema": "Identificamos el problema por experiencia directa de alguien del equipo en ese sector.",
                  "DescripcionProblema": "El problema lo viven pacientes con secuelas neurológicas severas (como trauma craneoencefálico o parálisis) y sus familias, especialmente en estratos bajos.  ¿Con qué frecuencia? Es una crisis diaria y continua. Cada día que pasa sin rehabilitación, el cuerpo del paciente se deteriora de forma irreversible.  ¿Qué consecuencias tiene? El sistema de salud actual (IPS) suele negar o demorar crónicamente las terapias especializadas, y los bipedestadores comerciales tienen costos prohibitivos para la economía familiar. Esto condena a los pacientes a la inmovilidad permanente, lo que genera consecuencias físicas graves como atrofia muscular, problemas circulatorios y escaras. Además, causa un impacto psicológico devastador en el paciente y un desgaste económico y emocional severo en sus cuidadores familiares, perpetuando un ciclo de exclusión y vulnerabilidad debido a la falta de tecnología asistiva accesible.",
                  "ValidacionProblema": "Hice entrevistas informales con personas que podrían ser usuarios o clientes. ;Tengo estudios previos propios o de terceros que respaldan la existencia del problema.",
                  "PersonasEntrevistadas": "Entre 6 y 15 personas.",
                  "ResultadoConversaciones": "La idea se mantuvo igual; los usuarios confirmaron exactamente lo que pensábamos.",
                  "TipoClientePrincipal": "Consumidor final (Vendes directamente a personas para uso personal)-B2C.;Gobierno o entidades públicas (Vendes a alcaldías, instituciones públicas o entidades del Estado)-B2G.;Empresas o negocios (Vendes a empresas, emprendimientos o negocios)-B2B.",
                  "EvidenciaInteresSolucion": "Personas me han dicho verbalmente que les parece buena idea.",
                  "EvidenciaInteresOtro": "",
                  "ConocimientoCompetencia": "He identificado algunas soluciones alternativas o sustitutas.",
                  "EstimacionMercado": "Tengo una idea general, pero sin números respaldados por fuentes.",
                  "AlcanceGeografico": "Principales ciudades de Colombia.",
                  "PropuestaValor": "Para pacientes con secuelas neurológicas severas de familias con recursos limitados, desarrollamos bipedestadores modulares de bajo costo fabricados con materiales reciclados de alta resistencia y un modelo de atención terapéutica accesible. A diferencia de las costosas opciones comerciales importadas y las demoras crónicas del sistema de salud, nuestra solución elimina las barreras económicas de acceso y previene el deterioro físico irreversible desde un enfoque de economía circular.",
                  "ClaridadValor": "La tengo estructurada",
                  "DiferenciaCompetencia": "Contamos con know-how o conocimiento especializado difícil de replicar.;Tenemos acceso a datos propios o información diferenciadora.;Ofrecemos una alternativa con costos más eficientes.",
                  "SectorProductivo": "Instrumentos de precisión y diagnóstico médico;Economía verde y circular (sostenibilidad, reciclaje, carbono neutro);Ciencias de la vida (salud, genómica, bioinformática)",
                  "ModeloIngresos": "Combinación de varios de los anteriores.",
                  "Canales": "Venta directa por parte del equipo fundador (nosotros mismos vendemos).",
                  "AliadosEstrategicos": "Estoy en conversaciones informales con posibles aliados.",
                  "TieneVentas": "No",
                  "FacturacionTotal": "",
                  "PromedioVentasMensual3M": "",
                  "PuntoEquilibrio": "",
                  "RegistrosContablesDisponibles": "",
                  "EstadoProteccionPI": "He hecho un análisis preliminar pero no tenemos protección formal aún.",
                  "TipoProteccionPI": "Todavía no aplicamos ninguno.",
                  "DuenoLegalPI": "Todavía no está definida la titularidad.",
                  "LibertadOperacion": "He hecho una revisión informal (búsquedas rápidas en Google o bases de datos).",
                  "RolesEquipoCubiertos": "Responsable de negocio o desarrollo comercial (alguien que piensa en cliente, ventas, modelo). ;Responsable de producto, UX o ingeniería aplicada.   TMRL;Responsable financiero u operaciones.",
                  "ExperienciaEmprendimientoTransferencia": "Alguien participó en programas formativos de emprendimiento (cursos, bootcamps).",
                  "DedicacionEquipo": "Entre 13 y 20 horas por semana.",
                  "DisponibilidadTiempoCompleto": "Sí, hay al menos una persona comprometida a hacerlo.",
                  "MujeresEquipo": "2",
                  "BonoEquidadAplica": true,
                  "JustificacionEquipoMercado": "Nuestro equipo fusiona de manera única el rigor de la ingeniería, la gestión de operaciones y una profunda motivación humana. Como ingeniera industrial y tecnóloga en talento humano, aporto la capacidad técnica para diseñar procesos productivos eficientes, estructurar costos óptimos y liderar la logística de manufactura bajo un enfoque de economía circular.  Al ser una iniciativa cofundada junto a mi madre, compartimos una conexión directa, real y empática con las barreras del entorno de la rehabilitación neurológica. Esta vivencia familiar nos otorga una comprensión profunda de las necesidades insatisfechas del usuario que la industria comercial tradicional ignora. No somos solo un equipo técnico; somos una unidad comprometida con la ingeniería de impacto social, con el conocimiento operativo y la resiliencia necesarios para transformar la accesibilidad asistencial.",
                  "InversionAcumulada": "Menos de 10 millones de COP.",
                  "FuentesInversion": "Recursos propios del equipo o familia (FFF).",
                  "NecesidadFinanciera12Meses": "Entre 20 y 70 millones.",
                  "RecursosOperacion6Meses": "Parcialmente (cubro menos del 50% de lo que necesito).",
                  "BuscaInversion": "Sí, estamos en etapa de preparación (deck, proyecciones, pitch).",
                  "EstadoLegal": "Estoy evaluando qué figura jurídica sería la adecuada (SAS, Ltda, etc.).",
                  "VerticalSostenibilidad": "Economía circular.;Salud y biotecnología.",
                  "ODSRelacionados": "ODS 3: Salud y bienestar;ODS 10: Reducción de las desigualdades;ODS 12: Producción y consumo responsables",
                  "MideImpacto": "Tenemos métricas cuantificables propuestas, pero aún no las medimos.",
                  "RequiereRegulacion": "INVIMA (medicamentos, alimentos, dispositivos médicos, cosméticos).",
                  "EstadoTramitesRegulatorios": "No hemos iniciado los trámites.",
                  "VideoPitchURL": "https://example.com/s2v-2026-015/video-pitch",
                  "URLAnexo1": "https://example.com/s2v-2026-015/anexo1",
                  "RetoPrograma": "Nuestro reto principal en el programa es realizar la transición estructurada desde la fase de diseño conceptual y modelado técnico de ingeniería (TRL 2) hacia la fabricación y validación mecánica de los primeros prototipos funcionales de bipedestadores modulares utilizando materiales reciclados.  Para lograrlo de forma exitosa, requerimos el acompañamiento experto de Science2Venture en dos frentes críticos: primero, la estructuración del mapa de ruta regulatorio y de cumplimiento de estándares exigidos por el INVIMA para dispositivos médicos de asistencia en rehabilitación; y segundo, el refinamiento de las proyecciones financieras para asegurar la viabilidad del modelo de ingresos mixto y la futura apertura de nuestro centro terapéutico. Buscamos transformar planos técnicos en una solución real, segura y financieramente sostenible para las familias.",
                  "EstadoPostulacion": "Recibida",
                  "CoherenciaTRLPreliminar": "Pendiente de revisión"
            },
            {
                  "IDOriginal": "17",
                  "IDIniciativa": "S2V-2026-016",
                  "NombreIniciativa": "Bioecoscan",
                  "NombreLider": "María Fernanda Bautista",
                  "CorreoLider": "m***9@gmail.com",
                  "Ciudad": "Bogota",
                  "VinculacionLider": "Estudiante",
                  "FacultadArea": "",
                  "RolIniciativa": "Financiera y desarrollo de negocio",
                  "SurgeGrupoSemillero": "No",
                  "GrupoOSemillero": "",
                  "AreaConocimiento": "Ingeniería y tecnología",
                  "EnfoqueProyecto": "Tecnología avanzada",
                  "DescripcionCorta": "Bioecoscan es un dispositivo tecnológico que convierte los campos agrícolas en sistemas inteligentes y verificables.  El problema: La agricultura tradicional daña el suelo, depende de fertilizantes costosos y no puede demostrar con datos reales si sus prácticas son sostenibles. Además, el 60–70% de los créditos ambientales actuales son cuestionados por falta de evidencia.  La solución: BIOECODATA instala sensores en el suelo, usa imágenes satelitales y análisis de laboratorio para monitorear en tiempo real la salud del ecosistema. Esos datos se registran en blockchain, haciéndolos verificables e inmutables.  El impacto: Los agricultores reducen costos hasta un 50%, acceden a mercados premium internacionales, generan bonos de carbono certificados y cumplen regulaciones ambientales globales como el Pacto Verde Europeo.  En resumen: transforma la tierra en un activo financiero medible, honesto y rentable.",
                  "PosturaEquityEan": "Si estoy de acuerdo con que la Universidad tenga participación.",
                  "AnioInicioTecnologia": "2022",
                  "TRLDeclarado": "TRL 2 Concepto de tecnología formulado",
                  "TRLNum": 2,
                  "RutaTRL": "TRL 1-3",
                  "CRLDeclarado": "CRL 2 Conocimiento del mercado",
                  "CRLNum": 2,
                  "BRLDeclarado": "BRL 2 Ajuste problema–solución",
                  "BRLNum": 2,
                  "EvidenciasTRL": "Todavía no tenemos evidencias documentadas.",
                  "EntornoPruebaTecnologia": "Todavía no la he probado físicamente (solo en papel, modelado o simulación).",
                  "BrechaTecnicaPrincipal": "Construir el primer prototipo integrado (combinar los componentes en un solo sistema).",
                  "TipoTecnologia": "Mi proyecto es Deep Tech",
                  "OrigenTecnologia": "Combinamos varias tecnologías existentes para crear algo nuevo que antes no existía así.",
                  "ComplejidadTecnica": "Muy alto (Deep Tech)",
                  "EvidenciasDocumentadas": "No cuento todavía con evidencias documentadas del avance técnico.",
                  "EvidenciasURL": "",
                  "OrigenProblema": "Identificamos el problema por experiencia directa de alguien del equipo en ese sector.",
                  "DescripcionProblema": "El agricultor que intenta ser sostenible enfrenta una paradoja cruel: invierte en insumos biológicos cada temporada, pero sin datos reales no puede demostrar que funcionan, ni ante un banco, ni ante un comprador internacional, ni ante un regulador.  Este ciclo ocurre cada temporada productiva, sin excepción.  Las consecuencias son concretas: el suelo se degrada silenciosamente, los costos no bajan, y el productor queda excluido de mercados premium que exigen trazabilidad verificable. Al mismo tiempo, el 60–70% de los créditos de carbono actuales son cuestionados globalmente por falta de evidencia medible.  El problema real no es agrícola — es de información ausente. Nadie monitorea el ecosistema completo en tiempo real, con datos que resistan auditoría internacional.  Bioecoscan resuelve eso: convierte lo invisible del suelo en datos verificables, permanentes y financieramente valorables.",
                  "ValidacionProblema": "Revisé literatura académica y reportes sectoriales que describen el problema.;Hice entrevistas informales con personas que podrían ser usuarios o clientes. ;Tengo estudios previos propios o de terceros que respaldan la existencia del problema.",
                  "PersonasEntrevistadas": "Entre 1 y 5 personas.",
                  "ResultadoConversaciones": "La idea se mantuvo igual; los usuarios confirmaron exactamente lo que pensábamos.",
                  "TipoClientePrincipal": "Empresas o negocios (Vendes a empresas, emprendimientos o negocios)-B2B.;Gobierno o entidades públicas (Vendes a alcaldías, instituciones públicas o entidades del Estado)-B2G.;Todavía no lo tengo del todo claro.",
                  "EvidenciaInteresSolucion": "Personas me han dicho verbalmente que les parece buena idea. ;Tengo cartas de intención (LOI) firmadas por potenciales clientes.;Tengo acuerdos de confidencialidad (NDA) firmados con clientes que evalúan mi solución.",
                  "EvidenciaInteresOtro": "",
                  "ConocimientoCompetencia": "He identificado algunas soluciones alternativas o sustitutas.",
                  "EstimacionMercado": "Tengo una idea general, pero sin números respaldados por fuentes.",
                  "AlcanceGeografico": "Varios países (internacional).",
                  "PropuestaValor": "Bioecoscan es para productores agrícolas y empresas que necesitan demostrar sostenibilidad real con datos verificables. Convertimos el ecosistema del suelo en información auditable en tiempo real — desde sensores en campo hasta certificación en blockchain — permitiendo reducir costos operativos entre un 20% y 50%, acceder a mercados premium internacionales y generar créditos de carbono que resisten cualquier auditoría. A diferencia de los insumos convencionales, no corregimos síntomas: construimos infraestructura biológica permanente con evidencia matemática.",
                  "ClaridadValor": "La tengo en una frase general, pero sin estructura.",
                  "DiferenciaCompetencia": "Ofrecemos una alternativa con costos más eficientes.;Tenemos acceso a infraestructura, laboratorios o alianzas estratégicas.",
                  "SectorProductivo": "Economía verde y circular (sostenibilidad, reciclaje, carbono neutro);Tecnologías de la información y comunicación (TIC);Economía digital (plataformas, comercio electrónico, fintech)",
                  "ModeloIngresos": "Todavía no he pensado cómo voy a generar ingresos.",
                  "Canales": "Alianzas con empresas que integran nuestra solución dentro de la suya.",
                  "AliadosEstrategicos": "Tengo acuerdos no vinculantes firmados (MoU, cartas de colaboración).",
                  "TieneVentas": "No",
                  "FacturacionTotal": "",
                  "PromedioVentasMensual3M": "",
                  "PuntoEquilibrio": "",
                  "RegistrosContablesDisponibles": "",
                  "EstadoProteccionPI": "He hecho un análisis preliminar pero no tenemos protección formal aún.",
                  "TipoProteccionPI": "Todavía no aplicamos ninguno.",
                  "DuenoLegalPI": "Co-titularidad con una empresa privada.",
                  "LibertadOperacion": "He hecho una revisión informal (búsquedas rápidas en Google o bases de datos).",
                  "RolesEquipoCubiertos": "Investigador principal con dominio técnico-científico. ;Co-investigador técnico que complementa al principal. ;Responsable de negocio o desarrollo comercial (alguien que piensa en cliente, ventas, modelo).",
                  "ExperienciaEmprendimientoTransferencia": "Alguien creó una empresa previamente, aunque no haya prosperado.",
                  "DedicacionEquipo": "Tiempo completo.",
                  "DisponibilidadTiempoCompleto": "Sí, hay al menos una persona comprometida a hacerlo.",
                  "MujeresEquipo": "1",
                  "BonoEquidadAplica": true,
                  "JustificacionEquipoMercado": "Nos complementamos",
                  "InversionAcumulada": "Menos de 10 millones de COP.",
                  "FuentesInversion": "Recursos propios del equipo o familia (FFF).",
                  "NecesidadFinanciera12Meses": "Entre 20 y 70 millones.",
                  "RecursosOperacion6Meses": "No.",
                  "BuscaInversion": "Sí, estamos en etapa de preparación (deck, proyecciones, pitch).",
                  "EstadoLegal": "Estoy evaluando qué figura jurídica sería la adecuada (SAS, Ltda, etc.).",
                  "VerticalSostenibilidad": "Economía circular.;Soluciones basadas en la naturaleza y bionegocios.",
                  "ODSRelacionados": "ODS 9: Industria, innovación e infraestructura;ODS 12: Producción y consumo responsables;ODS 11: Ciudades y comunidades sostenibles",
                  "MideImpacto": "Tenemos métricas cualitativas generales (sin números).",
                  "RequiereRegulacion": "No requiere autorizaciones específicas.",
                  "EstadoTramitesRegulatorios": "No aplica (no requiere autorizaciones).",
                  "VideoPitchURL": "https://example.com/s2v-2026-016/video-pitch",
                  "URLAnexo1": "https://example.com/s2v-2026-016/anexo1",
                  "RetoPrograma": "El obstáculo más urgente de Bioecoscan no es únicamente tecnológico — nuestra plataforma de monitoreo ecosistémico integra sensores IoT, imágenes satelitales y registro en blockchain. Sin embargo, enfrentamos dos retos simultáneos que frenan nuestro avance.  El primero es el desarrollo y consolidación del prototipo funcional. Aunque contamos con una arquitectura tecnológica definida, necesitamos apoyo para materializar un prototipo robusto, validado en campo y con la integración completa de sus componentes — sensores Rizo-Spectra, motor algorítmico y certificación blockchain — que soporte pruebas reales con usuarios.  El segundo es la estructuración del modelo de negocio y la validación comercial. Tenemos una propuesta de valor diferenciada, pero necesitamos acompañamiento para definir el segmento prioritario, estructurar el esquema de ingresos — ¿suscripción, licencia, créditos de carbono certificados, o combinación? — y conseguir los primeros contratos piloto con productores agrícolas o empresas con compromisos ESG.  Science2Venture nos permitiría cerrar ambas brechas simultáneamente: pasar de una arquitectura técnica planteada a un prototipo validado, y de ahí a una empresa viable con tracción comercial real, accediendo a mentores en transferencia tecnológica, mercados verdes internacionales y financiación climática para escalar desde Colombia hacia Latinoamérica.",
                  "EstadoPostulacion": "Recibida",
                  "CoherenciaTRLPreliminar": "Pendiente de revisión"
            },
            {
                  "IDOriginal": "18",
                  "IDIniciativa": "S2V-2026-017",
                  "NombreIniciativa": "NIUFEX – \"Espumógeno para extinción de incendios libre de PFAS elaborado con Tensoactivos semisintéticos de tipo aniónico obtenidos a partir del reciclaje de aceites de cocina usados\"",
                  "NombreLider": "José Mauricio Cossio Gómez",
                  "CorreoLider": "g***o@gmail.com",
                  "Ciudad": "Barrancabermeja",
                  "VinculacionLider": "Graduado",
                  "FacultadArea": "",
                  "RolIniciativa": "Investigador",
                  "SurgeGrupoSemillero": "No",
                  "GrupoOSemillero": "",
                  "AreaConocimiento": "Ingeniería y tecnología",
                  "EnfoqueProyecto": "Producto",
                  "DescripcionCorta": "Estamos desarrollando un Espumógeno para extinción de incendios Clase A y B libre de PFAS. La problemática que estamos resolviendo es la contaminación de fuentes de agua por espumas Fluoradas. El impacto de este proyecto es la reducción de la contaminación ambiental y la disminución de riesgos a la salud por uso de estos \"químicos eternos\".",
                  "PosturaEquityEan": "Si estoy de acuerdo con que la Universidad tenga participación.",
                  "AnioInicioTecnologia": "2024",
                  "TRLDeclarado": "TRL 5 Validación en entorno relevante",
                  "TRLNum": 5,
                  "RutaTRL": "TRL 4-6",
                  "CRLDeclarado": "CRL 2 Conocimiento del mercado",
                  "CRLNum": 2,
                  "BRLDeclarado": "BRL 2 Ajuste problema–solución",
                  "BRLNum": 2,
                  "EvidenciasTRL": "Prototipo físico o digital con fotos o videos que lo muestren funcionando. ;Ensayos certificados por un laboratorio externo acreditado.;Ponencia o presentación en evento científico o tecnológico.",
                  "EntornoPruebaTecnologia": "En entorno simulado que reproduce condiciones reales (pruebas de campo controladas).",
                  "BrechaTecnicaPrincipal": "Asegurar que el prototipo sea confiable, reproducible y dure lo suficiente para ser usado.",
                  "TipoTecnologia": "No uso herramientas tecnológicas especiales; mi proyecto se apoya en procesos tradicionales.",
                  "OrigenTecnologia": "Toda la tecnología central fue creada por nuestro equipo desde cero.",
                  "ComplejidadTecnica": "Muy bajo",
                  "EvidenciasDocumentadas": "Sí, cuento con evidencias documentadas que pueden ser revisadas en esta convocatoria.",
                  "EvidenciasURL": "https://example.com/s2v-2026-017/evidencias",
                  "OrigenProblema": "Identificamos el problema leyendo literatura académica, reportes del sector o noticias.",
                  "DescripcionProblema": "El problema que resuelvo es la contaminación del agua, del suelo y de las personas por uso de productos fluorados en los espumógenos actuales. Los directamente afectados por esta situación son los bomberos, que trabajan directamente con estas espumas y que les esta trayendo consecuencias graves para su salud.",
                  "ValidacionProblema": "Revisé literatura académica y reportes sectoriales que describen el problema.;Tengo estudios previos propios o de terceros que respaldan la existencia del problema. ;Hice entrevistas informales con personas que podrían ser usuarios o clientes.",
                  "PersonasEntrevistadas": "Entre 1 y 5 personas.",
                  "ResultadoConversaciones": "La idea se mantuvo igual; los usuarios confirmaron exactamente lo que pensábamos.",
                  "TipoClientePrincipal": "Empresas o negocios (Vendes a empresas, emprendimientos o negocios)-B2B.;Gobierno o entidades públicas (Vendes a alcaldías, instituciones públicas o entidades del Estado)-B2G.",
                  "EvidenciaInteresSolucion": "Personas me han dicho verbalmente que les parece buena idea.",
                  "EvidenciaInteresOtro": "",
                  "ConocimientoCompetencia": "He identificado algunas soluciones alternativas o sustitutas.",
                  "EstimacionMercado": "He calculado el TAM (mercado total) con datos secundarios.",
                  "AlcanceGeografico": "Varios países (internacional).",
                  "PropuestaValor": "Espumógeno libre de PFAS, de baja viscosidad, primer espumógeno de fabricación 100% Colombiano (inclusive en América Latina), precio mas económico que los del mercado.",
                  "ClaridadValor": "La tengo estructurada",
                  "DiferenciaCompetencia": "Tenemos tecnología protegida (patente, secreto industrial, registro de software). ;Ofrecemos una alternativa con costos más eficientes.;Contamos con know-how o conocimiento especializado difícil de replicar.",
                  "SectorProductivo": "Aeroespacial y defensa;Petroquímica y refinación;Otro",
                  "ModeloIngresos": "Combinación de varios de los anteriores.",
                  "Canales": "Distribuidores o representantes en Colombia que venden por nosotros.",
                  "AliadosEstrategicos": "Todavía no tengo aliados formales.",
                  "TieneVentas": "No",
                  "FacturacionTotal": "",
                  "PromedioVentasMensual3M": "",
                  "PuntoEquilibrio": "",
                  "RegistrosContablesDisponibles": "",
                  "EstadoProteccionPI": "Protegemos por secreto industrial con documentación y controles formales.",
                  "TipoProteccionPI": "Registro de marca.",
                  "DuenoLegalPI": "Todavía no está definida la titularidad.",
                  "LibertadOperacion": "He hecho un análisis preliminar con búsqueda básica en bases de patentes.",
                  "RolesEquipoCubiertos": "Investigador principal con dominio técnico-científico. ;Responsable de negocio o desarrollo comercial (alguien que piensa en cliente, ventas, modelo). ;Responsable financiero u operaciones. ;Co-investigador técnico que complementa al principal.",
                  "ExperienciaEmprendimientoTransferencia": "Alguien creó y operó una empresa exitosa.",
                  "DedicacionEquipo": "Tiempo completo.",
                  "DisponibilidadTiempoCompleto": "Ya hay alguien dedicado tiempo completo al proyecto hoy.",
                  "MujeresEquipo": "0",
                  "BonoEquidadAplica": false,
                  "JustificacionEquipoMercado": "Porque el mercado y las empresas estan pidiendo este Espumógeno de manera urgente, ya que se requieren realizar validaciones y cambios de espumas sin contenido PFAS",
                  "InversionAcumulada": "Menos de 10 millones de COP.",
                  "FuentesInversion": "Recursos propios del equipo o familia (FFF).",
                  "NecesidadFinanciera12Meses": "Entre 20 y 70 millones.",
                  "RecursosOperacion6Meses": "Parcialmente (cubro menos del 50% de lo que necesito).",
                  "BuscaInversion": "Sí, estamos en etapa de preparación (deck, proyecciones, pitch).",
                  "EstadoLegal": "Empresa constituida legalmente y con RUT.",
                  "VerticalSostenibilidad": "Economía circular.;ClimaTech.",
                  "ODSRelacionados": "ODS 6: Agua limpia y saneamiento;ODS 12: Producción y consumo responsables;ODS 13: Acción por el clima",
                  "MideImpacto": "Tenemos métricas cuantificables propuestas, pero aún no las medimos.",
                  "RequiereRegulacion": "No requiere autorizaciones específicas.",
                  "EstadoTramitesRegulatorios": "No aplica (no requiere autorizaciones).",
                  "VideoPitchURL": "https://example.com/s2v-2026-017/video-pitch",
                  "URLAnexo1": "https://example.com/s2v-2026-017/anexo1",
                  "RetoPrograma": "Queremos validar el producto bajo normas internacionales para extinción de incendios para fuegos Clase A y B, y queremos realizar pruebas de validación del producto en campo con fuego real simulado",
                  "EstadoPostulacion": "Recibida",
                  "CoherenciaTRLPreliminar": "Pendiente de revisión"
            },
            {
                  "IDOriginal": "23",
                  "IDIniciativa": "S2V-2026-018",
                  "NombreIniciativa": "El cambio como mecánica de juego: Desarrollo de un RPG educativo para la enseñanza de derivadas",
                  "NombreLider": "Nicolás Varón Bernal",
                  "CorreoLider": "n***1@universidadean.edu.co",
                  "Ciudad": "Bogotá",
                  "VinculacionLider": "Estudiante",
                  "FacultadArea": "",
                  "RolIniciativa": "Desarrollador",
                  "SurgeGrupoSemillero": "Sí, de un grupo de investigación",
                  "GrupoOSemillero": "ONTARE - Tecnología",
                  "AreaConocimiento": "Ingeniería y tecnología",
                  "EnfoqueProyecto": "Digital",
                  "DescripcionCorta": "Se busca crear un videojuego que enseñe a los estudiantes a derivar",
                  "PosturaEquityEan": "Si estoy de acuerdo con que la Universidad tenga participación.",
                  "AnioInicioTecnologia": "2025",
                  "TRLDeclarado": "TRL 2 Concepto de tecnología formulado",
                  "TRLNum": 2,
                  "RutaTRL": "TRL 1-3",
                  "CRLDeclarado": "CRL 3 Aplicación de Tecnología",
                  "CRLNum": 3,
                  "BRLDeclarado": "BRL 1 Concepto inicial",
                  "BRLNum": 1,
                  "EvidenciasTRL": "Ponencia o presentación en evento científico o tecnológico. ;Prototipo físico o digital con fotos o videos que lo muestren funcionando.",
                  "EntornoPruebaTecnologia": "Solo en laboratorio controlado (universidad u otra institución)",
                  "BrechaTecnicaPrincipal": "Escalar el prototipo de laboratorio a condiciones reales (que funcione fuera del laboratorio).",
                  "TipoTecnologia": "Uso tecnologías avanzadas existentes (IA comercial, software especializado, analítica avanzada).",
                  "OrigenTecnologia": "Solo usamos herramientas que ya existen, sin modificarlas.",
                  "ComplejidadTecnica": "Medio",
                  "EvidenciasDocumentadas": "Sí, cuento con evidencias documentadas que pueden ser revisadas en esta convocatoria.",
                  "EvidenciasURL": "https://example.com/s2v-2026-018/evidencias",
                  "OrigenProblema": "Identificamos el problema por experiencia directa de alguien del equipo en ese sector.",
                  "DescripcionProblema": "Lo viven estudiantes universitarios enfrentados al cálculo, quienes suelen experimentar frustración y desconexión con la teoría tradicional.  Se vive con alta frecuencia, prácticamente en cada clase, sesión de estudio o examen donde los conceptos se sienten abstractos y aburridos.  Las consecuencias son el desinterés y la deserción académica.",
                  "ValidacionProblema": "Hice entrevistas informales con personas que podrían ser usuarios o clientes. ;Revisé literatura académica y reportes sectoriales que describen el problema.;Hice pruebas piloto con la solución real (aunque sea versión básica) con usuarios.",
                  "PersonasEntrevistadas": "Entre 1 y 5 personas.",
                  "ResultadoConversaciones": "Ajustamos la propuesta de valor (lo que ofrecemos o cómo lo presentamos).",
                  "TipoClientePrincipal": "Consumidor final (Vendes directamente a personas para uso personal)-B2C.",
                  "EvidenciaInteresSolucion": "Personas me han dicho verbalmente que les parece buena idea.",
                  "EvidenciaInteresOtro": "",
                  "ConocimientoCompetencia": "Creo que no existe competencia directa para lo que hago.",
                  "EstimacionMercado": "Todavía no lo he estimado.",
                  "AlcanceGeografico": "Principales ciudades de Colombia.",
                  "PropuestaValor": "Para estudiantes que luchan contra la frustración del cálculo tradicional, nuestro RPG transforma el aprendizaje de las derivadas en una aventura épica donde dominar las matemáticas es la única forma de salvar el día. A diferencia de las plataformas educativas aburridas, nosotros no disfrazamos la teoría de juego: convertimos las mecánicas del videojuego en el método de aprendizaje, capitalizando una pasión global que los jóvenes ya aman.",
                  "ClaridadValor": "La tengo en una frase general, pero sin estructura.",
                  "DiferenciaCompetencia": "Aún no hemos identificado un factor diferenciador claro.",
                  "SectorProductivo": "Industrias creativas y culturales (videojuegos, diseño, contenidos digitales)",
                  "ModeloIngresos": "Venta única del producto o servicio (el cliente paga una vez).",
                  "Canales": "Plataforma digital o e-commerce propio.",
                  "AliadosEstrategicos": "Todavía no tengo aliados formales.",
                  "TieneVentas": "No",
                  "FacturacionTotal": "",
                  "PromedioVentasMensual3M": "",
                  "PuntoEquilibrio": "",
                  "RegistrosContablesDisponibles": "",
                  "EstadoProteccionPI": "Todavía no he pensado en proteger la PI.",
                  "TipoProteccionPI": "Registro de marca.",
                  "DuenoLegalPI": "Todavía no está definida la titularidad.",
                  "LibertadOperacion": "No he considerado ese tema.",
                  "RolesEquipoCubiertos": "Investigador principal con dominio técnico-científico.",
                  "ExperienciaEmprendimientoTransferencia": "Ninguno tiene experiencia previa.",
                  "DedicacionEquipo": "Entre 5 y 8 horas por semana.",
                  "DisponibilidadTiempoCompleto": "No, todos seguiremos en dedicación parcial.",
                  "MujeresEquipo": "0",
                  "BonoEquidadAplica": false,
                  "JustificacionEquipoMercado": "Nuestra ventaja radica en que rediseñamos la educación matemática bajo un formato universal: el videojuego. Al trasladar la enseñanza de las derivadas a las dinámicas de un RPG, capitalizamos una pasión existente para eliminar el miedo al cálculo. No creamos la necesidad de jugar, redirigimos el amor por el juego hacia el éxito académico.",
                  "InversionAcumulada": "Menos de 10 millones de COP.",
                  "FuentesInversion": "Recursos propios del equipo o familia (FFF).",
                  "NecesidadFinanciera12Meses": "Todavía no lo he estimado.",
                  "RecursosOperacion6Meses": "No.",
                  "BuscaInversion": "No, por ahora no es una prioridad.",
                  "EstadoLegal": "Todavía no he pensado en constituir empresa.",
                  "VerticalSostenibilidad": "EdTech.",
                  "ODSRelacionados": "ODS 4: Educación de calidad",
                  "MideImpacto": "Tenemos métricas cuantificables propuestas, pero aún no las medimos.",
                  "RequiereRegulacion": "No requiere autorizaciones específicas.",
                  "EstadoTramitesRegulatorios": "No aplica (no requiere autorizaciones).",
                  "VideoPitchURL": "https://example.com/s2v-2026-018/video-pitch",
                  "URLAnexo1": "https://example.com/s2v-2026-018/anexo1",
                  "RetoPrograma": "Validación y Refinamiento de los Puzzles: Asegurar que el diseño de los acertijos basados en derivadas sea intuitivo para el estudiante y riguroso para el docente, logrando el equilibrio perfecto entre diversión y aprendizaje sin que el juego se sienta como un examen camuflado.  Estrategia de Comercialización (Go-to-Market): Definir el modelo de negocio adecuado para introducir esta tecnología en el sector educativo (EdTech) e instituciones académicas, un mercado con procesos de adopción tradicionalmente complejos.  Mentoría en Propiedad Intelectual y Escalabilidad: Estructurar el proyecto para que deje de ser un prototipo de aula y se convierta en un producto tecnológico protegible, atractivo para la inversión y listo para escalar a nivel internacional.",
                  "EstadoPostulacion": "Recibida",
                  "CoherenciaTRLPreliminar": "Pendiente de revisión"
            }
      ],
      "controlDocumental": [
            {
                  "IDIniciativa": "S2V-2026-001",
                  "NombreIniciativa": "Polen Hub",
                  "EstadoDocumentalGeneral": "Pendiente revisión",
                  "VideoPitchEstado": "Recibido",
                  "VideoPitchURL": "https://example.com/s2v-2026-001/video-pitch",
                  "EvidenciasEstado": "Recibidas",
                  "EvidenciasURL": "https://example.com/s2v-2026-001/evidencias",
                  "EstadoAnexo1": "Recibido",
                  "URLAnexo1": "https://example.com/s2v-2026-001/anexo1",
                  "MetodoRecepcionAnexo1": "Formulario",
                  "RequiereSubsanacion": "No"
            },
            {
                  "IDIniciativa": "S2V-2026-002",
                  "NombreIniciativa": "Click Agents",
                  "EstadoDocumentalGeneral": "Pendiente revisión",
                  "VideoPitchEstado": "Recibido",
                  "VideoPitchURL": "https://example.com/s2v-2026-002/video-pitch",
                  "EvidenciasEstado": "Pendiente revisión",
                  "EvidenciasURL": "",
                  "EstadoAnexo1": "Recibido",
                  "URLAnexo1": "https://example.com/s2v-2026-002/anexo1",
                  "MetodoRecepcionAnexo1": "Formulario",
                  "RequiereSubsanacion": "No"
            },
            {
                  "IDIniciativa": "S2V-2026-003",
                  "NombreIniciativa": "Munay",
                  "EstadoDocumentalGeneral": "Pendiente revisión",
                  "VideoPitchEstado": "Recibido",
                  "VideoPitchURL": "https://example.com/s2v-2026-003/video-pitch",
                  "EvidenciasEstado": "Sin evidencias",
                  "EvidenciasURL": "",
                  "EstadoAnexo1": "Recibido",
                  "URLAnexo1": "https://example.com/s2v-2026-003/anexo1",
                  "MetodoRecepcionAnexo1": "Formulario",
                  "RequiereSubsanacion": "No"
            },
            {
                  "IDIniciativa": "S2V-2026-004",
                  "NombreIniciativa": "EANMOB: Plataforma Inteligente de Movilidad Corporativa Compartida",
                  "EstadoDocumentalGeneral": "Pendiente revisión",
                  "VideoPitchEstado": "Recibido",
                  "VideoPitchURL": "https://example.com/s2v-2026-004/video-pitch",
                  "EvidenciasEstado": "Recibidas",
                  "EvidenciasURL": "https://example.com/s2v-2026-004/evidencias",
                  "EstadoAnexo1": "Recibido",
                  "URLAnexo1": "https://example.com/s2v-2026-004/anexo1",
                  "MetodoRecepcionAnexo1": "Formulario",
                  "RequiereSubsanacion": "No"
            },
            {
                  "IDIniciativa": "S2V-2026-005",
                  "NombreIniciativa": "FLUXEO ENERGY",
                  "EstadoDocumentalGeneral": "Pendiente revisión",
                  "VideoPitchEstado": "Recibido",
                  "VideoPitchURL": "https://example.com/s2v-2026-005/video-pitch",
                  "EvidenciasEstado": "Recibidas",
                  "EvidenciasURL": "https://example.com/s2v-2026-005/evidencias",
                  "EstadoAnexo1": "Recibido",
                  "URLAnexo1": "https://example.com/s2v-2026-005/anexo1",
                  "MetodoRecepcionAnexo1": "Formulario",
                  "RequiereSubsanacion": "No"
            },
            {
                  "IDIniciativa": "S2V-2026-006",
                  "NombreIniciativa": "Comunicación Sin Barreras",
                  "EstadoDocumentalGeneral": "Pendiente revisión",
                  "VideoPitchEstado": "Recibido",
                  "VideoPitchURL": "https://example.com/s2v-2026-006/video-pitch",
                  "EvidenciasEstado": "Recibidas",
                  "EvidenciasURL": "https://example.com/s2v-2026-006/evidencias",
                  "EstadoAnexo1": "Recibido",
                  "URLAnexo1": "https://example.com/s2v-2026-006/anexo1",
                  "MetodoRecepcionAnexo1": "Formulario",
                  "RequiereSubsanacion": "No"
            },
            {
                  "IDIniciativa": "S2V-2026-007",
                  "NombreIniciativa": "EcoVisión IA",
                  "EstadoDocumentalGeneral": "Pendiente revisión",
                  "VideoPitchEstado": "Recibido",
                  "VideoPitchURL": "https://example.com/s2v-2026-007/video-pitch",
                  "EvidenciasEstado": "Recibidas",
                  "EvidenciasURL": "https://example.com/s2v-2026-007/evidencias",
                  "EstadoAnexo1": "Recibido",
                  "URLAnexo1": "https://example.com/s2v-2026-007/anexo1",
                  "MetodoRecepcionAnexo1": "Formulario",
                  "RequiereSubsanacion": "No"
            },
            {
                  "IDIniciativa": "S2V-2026-008",
                  "NombreIniciativa": "Sapere Aude",
                  "EstadoDocumentalGeneral": "Pendiente revisión",
                  "VideoPitchEstado": "Recibido",
                  "VideoPitchURL": "https://example.com/s2v-2026-008/video-pitch",
                  "EvidenciasEstado": "Recibidas",
                  "EvidenciasURL": "https://example.com/s2v-2026-008/evidencias",
                  "EstadoAnexo1": "Recibido",
                  "URLAnexo1": "https://example.com/s2v-2026-008/anexo1",
                  "MetodoRecepcionAnexo1": "Formulario",
                  "RequiereSubsanacion": "No"
            },
            {
                  "IDIniciativa": "S2V-2026-009",
                  "NombreIniciativa": "Mi Terreno Colombia",
                  "EstadoDocumentalGeneral": "Pendiente revisión",
                  "VideoPitchEstado": "Recibido",
                  "VideoPitchURL": "https://example.com/s2v-2026-009/video-pitch",
                  "EvidenciasEstado": "Sin evidencias",
                  "EvidenciasURL": "",
                  "EstadoAnexo1": "Recibido",
                  "URLAnexo1": "https://example.com/s2v-2026-009/anexo1",
                  "MetodoRecepcionAnexo1": "Formulario",
                  "RequiereSubsanacion": "No"
            },
            {
                  "IDIniciativa": "S2V-2026-010",
                  "NombreIniciativa": "HandTalk CB",
                  "EstadoDocumentalGeneral": "Pendiente revisión",
                  "VideoPitchEstado": "Recibido",
                  "VideoPitchURL": "https://example.com/s2v-2026-010/video-pitch",
                  "EvidenciasEstado": "Pendiente revisión",
                  "EvidenciasURL": "",
                  "EstadoAnexo1": "Recibido",
                  "URLAnexo1": "https://example.com/s2v-2026-010/anexo1",
                  "MetodoRecepcionAnexo1": "Formulario",
                  "RequiereSubsanacion": "No"
            },
            {
                  "IDIniciativa": "S2V-2026-011",
                  "NombreIniciativa": "Animal&Human foods",
                  "EstadoDocumentalGeneral": "Pendiente revisión",
                  "VideoPitchEstado": "Recibido",
                  "VideoPitchURL": "https://example.com/s2v-2026-011/video-pitch",
                  "EvidenciasEstado": "Recibidas",
                  "EvidenciasURL": "https://example.com/s2v-2026-011/evidencias",
                  "EstadoAnexo1": "Recibido",
                  "URLAnexo1": "https://example.com/s2v-2026-011/anexo1",
                  "MetodoRecepcionAnexo1": "Formulario",
                  "RequiereSubsanacion": "No"
            },
            {
                  "IDIniciativa": "S2V-2026-012",
                  "NombreIniciativa": "Agente Hermes",
                  "EstadoDocumentalGeneral": "Pendiente revisión",
                  "VideoPitchEstado": "Recibido",
                  "VideoPitchURL": "https://example.com/s2v-2026-012/video-pitch",
                  "EvidenciasEstado": "Sin evidencias",
                  "EvidenciasURL": "",
                  "EstadoAnexo1": "Recibido",
                  "URLAnexo1": "https://example.com/s2v-2026-012/anexo1",
                  "MetodoRecepcionAnexo1": "Formulario",
                  "RequiereSubsanacion": "No"
            },
            {
                  "IDIniciativa": "S2V-2026-013",
                  "NombreIniciativa": "Biomuseo Nacional del Queso: Matrices poliméricas solubles y coagulantes nativos para la soberanía de la quesería artesanal.",
                  "EstadoDocumentalGeneral": "Pendiente revisión",
                  "VideoPitchEstado": "Recibido",
                  "VideoPitchURL": "https://example.com/s2v-2026-013/video-pitch",
                  "EvidenciasEstado": "Recibidas",
                  "EvidenciasURL": "https://example.com/s2v-2026-013/evidencias",
                  "EstadoAnexo1": "Recibido",
                  "URLAnexo1": "https://example.com/s2v-2026-013/anexo1",
                  "MetodoRecepcionAnexo1": "Formulario",
                  "RequiereSubsanacion": "No"
            },
            {
                  "IDIniciativa": "S2V-2026-014",
                  "NombreIniciativa": "CardioBio: Prevención de falla cardíaca mediante bioimpedancia.",
                  "EstadoDocumentalGeneral": "Pendiente revisión",
                  "VideoPitchEstado": "Recibido",
                  "VideoPitchURL": "https://example.com/s2v-2026-014/video-pitch",
                  "EvidenciasEstado": "Pendiente revisión",
                  "EvidenciasURL": "",
                  "EstadoAnexo1": "Recibido",
                  "URLAnexo1": "https://example.com/s2v-2026-014/anexo1",
                  "MetodoRecepcionAnexo1": "Formulario",
                  "RequiereSubsanacion": "No"
            },
            {
                  "IDIniciativa": "S2V-2026-015",
                  "NombreIniciativa": "Re-Evolución Biomecánica: Bipedestadores Sostenibles y Centro Terapéutico Integral",
                  "EstadoDocumentalGeneral": "Pendiente revisión",
                  "VideoPitchEstado": "Recibido",
                  "VideoPitchURL": "https://example.com/s2v-2026-015/video-pitch",
                  "EvidenciasEstado": "Sin evidencias",
                  "EvidenciasURL": "",
                  "EstadoAnexo1": "Recibido",
                  "URLAnexo1": "https://example.com/s2v-2026-015/anexo1",
                  "MetodoRecepcionAnexo1": "Formulario",
                  "RequiereSubsanacion": "No"
            },
            {
                  "IDIniciativa": "S2V-2026-016",
                  "NombreIniciativa": "Bioecoscan",
                  "EstadoDocumentalGeneral": "Pendiente revisión",
                  "VideoPitchEstado": "Recibido",
                  "VideoPitchURL": "https://example.com/s2v-2026-016/video-pitch",
                  "EvidenciasEstado": "Sin evidencias",
                  "EvidenciasURL": "",
                  "EstadoAnexo1": "Recibido",
                  "URLAnexo1": "https://example.com/s2v-2026-016/anexo1",
                  "MetodoRecepcionAnexo1": "Formulario",
                  "RequiereSubsanacion": "No"
            },
            {
                  "IDIniciativa": "S2V-2026-017",
                  "NombreIniciativa": "NIUFEX – \"Espumógeno para extinción de incendios libre de PFAS elaborado con Tensoactivos semisintéticos de tipo aniónico obtenidos a partir del reciclaje de aceites de cocina usados\"",
                  "EstadoDocumentalGeneral": "Pendiente revisión",
                  "VideoPitchEstado": "Recibido",
                  "VideoPitchURL": "https://example.com/s2v-2026-017/video-pitch",
                  "EvidenciasEstado": "Recibidas",
                  "EvidenciasURL": "https://example.com/s2v-2026-017/evidencias",
                  "EstadoAnexo1": "Recibido",
                  "URLAnexo1": "https://example.com/s2v-2026-017/anexo1",
                  "MetodoRecepcionAnexo1": "Formulario",
                  "RequiereSubsanacion": "No"
            },
            {
                  "IDIniciativa": "S2V-2026-018",
                  "NombreIniciativa": "El cambio como mecánica de juego: Desarrollo de un RPG educativo para la enseñanza de derivadas",
                  "EstadoDocumentalGeneral": "Pendiente revisión",
                  "VideoPitchEstado": "Recibido",
                  "VideoPitchURL": "https://example.com/s2v-2026-018/video-pitch",
                  "EvidenciasEstado": "Recibidas",
                  "EvidenciasURL": "https://example.com/s2v-2026-018/evidencias",
                  "EstadoAnexo1": "Recibido",
                  "URLAnexo1": "https://example.com/s2v-2026-018/anexo1",
                  "MetodoRecepcionAnexo1": "Formulario",
                  "RequiereSubsanacion": "No"
            }
      ],
      "miembrosEquipo": [
            {
                  "IDIniciativa": "S2V-2026-001",
                  "NombreMiembro": "Cristian David Rivillas Mejia",
                  "CorreoMiembro": "c***s@universidadean.edu.co",
                  "VinculacionMiembro": "Profesor / Investigador",
                  "RolIniciativa": "Desarrollador",
                  "OrdenMiembro": 1,
                  "EsLider": "Sí",
                  "EsEanista": "Sí",
                  "EsMujer": "No especificado",
                  "EstadoRegistro": "Activo"
            },
            {
                  "IDIniciativa": "S2V-2026-001",
                  "NombreMiembro": "Johan Ricardo Alonso Rodriguez",
                  "CorreoMiembro": "j***o@universodadean.edu.co",
                  "VinculacionMiembro": "Profesor / Investigador",
                  "RolIniciativa": "Investigador",
                  "OrdenMiembro": 2,
                  "EsLider": "No",
                  "EsEanista": "Sí",
                  "EsMujer": "No especificado",
                  "EstadoRegistro": "Activo"
            },
            {
                  "IDIniciativa": "S2V-2026-002",
                  "NombreMiembro": "juan sebastian camacho falla",
                  "CorreoMiembro": "j***o@gmail.com",
                  "VinculacionMiembro": "Estudiante",
                  "RolIniciativa": "SEO",
                  "OrdenMiembro": 1,
                  "EsLider": "Sí",
                  "EsEanista": "Sí",
                  "EsMujer": "No especificado",
                  "EstadoRegistro": "Activo"
            },
            {
                  "IDIniciativa": "S2V-2026-003",
                  "NombreMiembro": "Juan Manuel Rojas Guerrero",
                  "CorreoMiembro": "j***g@outlook.com",
                  "VinculacionMiembro": "Estudiante",
                  "RolIniciativa": "Desarrollador",
                  "OrdenMiembro": 1,
                  "EsLider": "Sí",
                  "EsEanista": "Sí",
                  "EsMujer": "No especificado",
                  "EstadoRegistro": "Activo"
            },
            {
                  "IDIniciativa": "S2V-2026-004",
                  "NombreMiembro": "Leonardo Andres Perez Cortes",
                  "CorreoMiembro": "l***z@universidadean.edu.co",
                  "VinculacionMiembro": "Profesor / Investigador",
                  "RolIniciativa": "Director y creador del proyecto",
                  "OrdenMiembro": 1,
                  "EsLider": "Sí",
                  "EsEanista": "Sí",
                  "EsMujer": "No especificado",
                  "EstadoRegistro": "Activo"
            },
            {
                  "IDIniciativa": "S2V-2026-004",
                  "NombreMiembro": "Sarah Sofia de la Cruz Cifuentes",
                  "CorreoMiembro": "s***9@universidadean.edu.co",
                  "VinculacionMiembro": "Estudiante",
                  "RolIniciativa": "Desarrollador ML",
                  "OrdenMiembro": 2,
                  "EsLider": "No",
                  "EsEanista": "Sí",
                  "EsMujer": "No especificado",
                  "EstadoRegistro": "Activo"
            },
            {
                  "IDIniciativa": "S2V-2026-004",
                  "NombreMiembro": "Justin Thomas Moreno Solano",
                  "CorreoMiembro": "j***9@universidadean.edu.co",
                  "VinculacionMiembro": "Estudiante",
                  "RolIniciativa": "Desarrollador backend (base de datos, autenticación) y desarrollador frontend",
                  "OrdenMiembro": 3,
                  "EsLider": "No",
                  "EsEanista": "Sí",
                  "EsMujer": "No especificado",
                  "EstadoRegistro": "Activo"
            },
            {
                  "IDIniciativa": "S2V-2026-004",
                  "NombreMiembro": "Maria Alejandra Rozo Ayala",
                  "CorreoMiembro": "m***2@universidadean.edu.co",
                  "VinculacionMiembro": "Estudiante",
                  "RolIniciativa": "Desarrolladora frontend",
                  "OrdenMiembro": 4,
                  "EsLider": "No",
                  "EsEanista": "Sí",
                  "EsMujer": "No especificado",
                  "EstadoRegistro": "Activo"
            },
            {
                  "IDIniciativa": "S2V-2026-004",
                  "NombreMiembro": "Isabella Naranjo Ramirez",
                  "CorreoMiembro": "i***4@universidadean.edu.co",
                  "VinculacionMiembro": "Estudiante",
                  "RolIniciativa": "Integración APIs y machine learning",
                  "OrdenMiembro": 5,
                  "EsLider": "No",
                  "EsEanista": "Sí",
                  "EsMujer": "No especificado",
                  "EstadoRegistro": "Activo"
            },
            {
                  "IDIniciativa": "S2V-2026-005",
                  "NombreMiembro": "Sebastian Andres Medina Raigoza",
                  "CorreoMiembro": "s***a@gmail.com",
                  "VinculacionMiembro": "Graduado",
                  "RolIniciativa": "Investigador principal, Capacidad para liderar el análisis de mercado y la estructuración del modelo de negocio.",
                  "OrdenMiembro": 1,
                  "EsLider": "Sí",
                  "EsEanista": "Sí",
                  "EsMujer": "No especificado",
                  "EstadoRegistro": "Activo"
            },
            {
                  "IDIniciativa": "S2V-2026-005",
                  "NombreMiembro": "Juan Gabriel Bustos Armenta",
                  "CorreoMiembro": "j***s@gmail.com",
                  "VinculacionMiembro": "Externo / Otra institución",
                  "RolIniciativa": "Responsable de propiedad intelectual y asuntos legales, Responsable de comunicación, relacionamiento con el ecosistema y del desarrollo de software para el despliegue de la solución tecnológica.",
                  "OrdenMiembro": 2,
                  "EsLider": "No",
                  "EsEanista": "No",
                  "EsMujer": "No especificado",
                  "EstadoRegistro": "Activo"
            },
            {
                  "IDIniciativa": "S2V-2026-006",
                  "NombreMiembro": "Diana Carolina Vargas Forero",
                  "CorreoMiembro": "d***7@universidadean.edu.co",
                  "VinculacionMiembro": "Estudiante",
                  "RolIniciativa": "Investigador",
                  "OrdenMiembro": 1,
                  "EsLider": "Sí",
                  "EsEanista": "Sí",
                  "EsMujer": "No especificado",
                  "EstadoRegistro": "Activo"
            },
            {
                  "IDIniciativa": "S2V-2026-006",
                  "NombreMiembro": "Nadia Irina Marcela Morales López",
                  "CorreoMiembro": "n***3@gmail.com",
                  "VinculacionMiembro": "Estudiante",
                  "RolIniciativa": "Investigador y desarrollador",
                  "OrdenMiembro": 2,
                  "EsLider": "No",
                  "EsEanista": "Sí",
                  "EsMujer": "No especificado",
                  "EstadoRegistro": "Activo"
            },
            {
                  "IDIniciativa": "S2V-2026-006",
                  "NombreMiembro": "Juliana Vásquez Duarte",
                  "CorreoMiembro": "j***7@gmail.com",
                  "VinculacionMiembro": "Estudiante",
                  "RolIniciativa": "Investigador",
                  "OrdenMiembro": 3,
                  "EsLider": "No",
                  "EsEanista": "Sí",
                  "EsMujer": "No especificado",
                  "EstadoRegistro": "Activo"
            },
            {
                  "IDIniciativa": "S2V-2026-007",
                  "NombreMiembro": "Daniel David Castañeda Moncada",
                  "CorreoMiembro": "d***0@universidadean.edu.co",
                  "VinculacionMiembro": "Estudiante",
                  "RolIniciativa": "Investigador y Desarrollador",
                  "OrdenMiembro": 1,
                  "EsLider": "Sí",
                  "EsEanista": "Sí",
                  "EsMujer": "No especificado",
                  "EstadoRegistro": "Activo"
            },
            {
                  "IDIniciativa": "S2V-2026-007",
                  "NombreMiembro": "Karol Sofía Gonzalez Diaz",
                  "CorreoMiembro": "k***0@universidadean.edu.co",
                  "VinculacionMiembro": "Estudiante",
                  "RolIniciativa": "Investigador y Desarrollador",
                  "OrdenMiembro": 2,
                  "EsLider": "No",
                  "EsEanista": "Sí",
                  "EsMujer": "No especificado",
                  "EstadoRegistro": "Activo"
            },
            {
                  "IDIniciativa": "S2V-2026-008",
                  "NombreMiembro": "Adriana Santos Sierra",
                  "CorreoMiembro": "a***a@gmail.com",
                  "VinculacionMiembro": "Estudiante",
                  "RolIniciativa": "Investigadora, creadora",
                  "OrdenMiembro": 1,
                  "EsLider": "Sí",
                  "EsEanista": "Sí",
                  "EsMujer": "No especificado",
                  "EstadoRegistro": "Activo"
            },
            {
                  "IDIniciativa": "S2V-2026-008",
                  "NombreMiembro": "Juan Sebastián Pérez Cárdenas",
                  "CorreoMiembro": "n***d@gmail.com",
                  "VinculacionMiembro": "Externo / Otra institución",
                  "RolIniciativa": "Coordinador de Contenido y Estrategia en Administración y Marketing",
                  "OrdenMiembro": 2,
                  "EsLider": "No",
                  "EsEanista": "No",
                  "EsMujer": "No especificado",
                  "EstadoRegistro": "Activo"
            },
            {
                  "IDIniciativa": "S2V-2026-009",
                  "NombreMiembro": "Angie Nathalia Aguirre Rosero",
                  "CorreoMiembro": "a***9@universidadean.edu.co",
                  "VinculacionMiembro": "Estudiante",
                  "RolIniciativa": "Lider",
                  "OrdenMiembro": 1,
                  "EsLider": "Sí",
                  "EsEanista": "Sí",
                  "EsMujer": "No especificado",
                  "EstadoRegistro": "Activo"
            },
            {
                  "IDIniciativa": "S2V-2026-010",
                  "NombreMiembro": "ESTEFANIA RODRIGUEZ MOSQUERA",
                  "CorreoMiembro": "e***6@universidadean.edu.co",
                  "VinculacionMiembro": "Estudiante",
                  "RolIniciativa": "Investigador principal",
                  "OrdenMiembro": 1,
                  "EsLider": "Sí",
                  "EsEanista": "Sí",
                  "EsMujer": "No especificado",
                  "EstadoRegistro": "Activo"
            },
            {
                  "IDIniciativa": "S2V-2026-010",
                  "NombreMiembro": "Natalia Andrea Granado Vallejo",
                  "CorreoMiembro": "n***8@universidadean.edu.co",
                  "VinculacionMiembro": "Estudiante",
                  "RolIniciativa": "Líder Técnico de IA y Desarrollo de Software",
                  "OrdenMiembro": 2,
                  "EsLider": "No",
                  "EsEanista": "Sí",
                  "EsMujer": "No especificado",
                  "EstadoRegistro": "Activo"
            },
            {
                  "IDIniciativa": "S2V-2026-010",
                  "NombreMiembro": "Santiago Ramos Grateron",
                  "CorreoMiembro": "s***8@universidadean.edu.co",
                  "VinculacionMiembro": "Estudiante",
                  "RolIniciativa": "Líder de Análisis de Mercado y Modelo de Negocio",
                  "OrdenMiembro": 3,
                  "EsLider": "No",
                  "EsEanista": "Sí",
                  "EsMujer": "No especificado",
                  "EstadoRegistro": "Activo"
            },
            {
                  "IDIniciativa": "S2V-2026-011",
                  "NombreMiembro": "Julian Jimenez Ruiz",
                  "CorreoMiembro": "j***8@universidadean.edu.co",
                  "VinculacionMiembro": "Estudiante",
                  "RolIniciativa": "Investigador",
                  "OrdenMiembro": 1,
                  "EsLider": "Sí",
                  "EsEanista": "Sí",
                  "EsMujer": "No especificado",
                  "EstadoRegistro": "Activo"
            },
            {
                  "IDIniciativa": "S2V-2026-011",
                  "NombreMiembro": "Laura Daniela Diaz Camacho",
                  "CorreoMiembro": "j***8@universidadean.edu.co",
                  "VinculacionMiembro": "Estudiante",
                  "RolIniciativa": "desarrollador",
                  "OrdenMiembro": 2,
                  "EsLider": "No",
                  "EsEanista": "Sí",
                  "EsMujer": "No especificado",
                  "EstadoRegistro": "Activo"
            },
            {
                  "IDIniciativa": "S2V-2026-012",
                  "NombreMiembro": "Julio César Rodríguez Cristancho",
                  "CorreoMiembro": "n***z@gmail.com",
                  "VinculacionMiembro": "Estudiante",
                  "RolIniciativa": "Fundador",
                  "OrdenMiembro": 1,
                  "EsLider": "Sí",
                  "EsEanista": "Sí",
                  "EsMujer": "No especificado",
                  "EstadoRegistro": "Activo"
            },
            {
                  "IDIniciativa": "S2V-2026-013",
                  "NombreMiembro": "Yudy Astrid Pulido Castillo",
                  "CorreoMiembro": "y***d@gmail.com",
                  "VinculacionMiembro": "Graduado",
                  "RolIniciativa": "Investigadora y gestora",
                  "OrdenMiembro": 1,
                  "EsLider": "Sí",
                  "EsEanista": "Sí",
                  "EsMujer": "No especificado",
                  "EstadoRegistro": "Activo"
            },
            {
                  "IDIniciativa": "S2V-2026-014",
                  "NombreMiembro": "ANGELA SOFIA LADINO MARSIGLIA",
                  "CorreoMiembro": "A***8@UNIVERSIDADEAN.EDU.CO",
                  "VinculacionMiembro": "Estudiante",
                  "RolIniciativa": "INVESTIGADOR",
                  "OrdenMiembro": 1,
                  "EsLider": "Sí",
                  "EsEanista": "Sí",
                  "EsMujer": "No especificado",
                  "EstadoRegistro": "Activo"
            },
            {
                  "IDIniciativa": "S2V-2026-015",
                  "NombreMiembro": "Maria Elena Capera Beltran",
                  "CorreoMiembro": "c***4@gmail.com",
                  "VinculacionMiembro": "Graduado",
                  "RolIniciativa": "Lider-Investigadora y desarrolladora.",
                  "OrdenMiembro": 1,
                  "EsLider": "Sí",
                  "EsEanista": "Sí",
                  "EsMujer": "No especificado",
                  "EstadoRegistro": "Activo"
            },
            {
                  "IDIniciativa": "S2V-2026-015",
                  "NombreMiembro": "Martha Beltran",
                  "CorreoMiembro": "y***6@gmail.com",
                  "VinculacionMiembro": "Externo / Otra institución",
                  "RolIniciativa": "Gestora",
                  "OrdenMiembro": 2,
                  "EsLider": "No",
                  "EsEanista": "No",
                  "EsMujer": "No especificado",
                  "EstadoRegistro": "Activo"
            },
            {
                  "IDIniciativa": "S2V-2026-016",
                  "NombreMiembro": "María Fernanda Bautista",
                  "CorreoMiembro": "m***9@gmail.com",
                  "VinculacionMiembro": "Estudiante",
                  "RolIniciativa": "Financiera y desarrollo de negocio",
                  "OrdenMiembro": 1,
                  "EsLider": "Sí",
                  "EsEanista": "Sí",
                  "EsMujer": "No especificado",
                  "EstadoRegistro": "Activo"
            },
            {
                  "IDIniciativa": "S2V-2026-016",
                  "NombreMiembro": "Ronald Xavier Bautista Espinosa",
                  "CorreoMiembro": "m***s@gmail.com",
                  "VinculacionMiembro": "Externo / Otra institución",
                  "RolIniciativa": "Ingeniero investigador",
                  "OrdenMiembro": 2,
                  "EsLider": "No",
                  "EsEanista": "No",
                  "EsMujer": "No especificado",
                  "EstadoRegistro": "Activo"
            },
            {
                  "IDIniciativa": "S2V-2026-016",
                  "NombreMiembro": "David Ben Amy",
                  "CorreoMiembro": "c***o@gmail.com",
                  "VinculacionMiembro": "Externo / Otra institución",
                  "RolIniciativa": "Gestor de la idea y lider",
                  "OrdenMiembro": 3,
                  "EsLider": "No",
                  "EsEanista": "No",
                  "EsMujer": "No especificado",
                  "EstadoRegistro": "Activo"
            },
            {
                  "IDIniciativa": "S2V-2026-017",
                  "NombreMiembro": "José Mauricio Cossio Gómez",
                  "CorreoMiembro": "g***o@gmail.com",
                  "VinculacionMiembro": "Graduado",
                  "RolIniciativa": "Investigador",
                  "OrdenMiembro": 1,
                  "EsLider": "Sí",
                  "EsEanista": "Sí",
                  "EsMujer": "No especificado",
                  "EstadoRegistro": "Activo"
            },
            {
                  "IDIniciativa": "S2V-2026-018",
                  "NombreMiembro": "Nicolás Varón Bernal",
                  "CorreoMiembro": "n***1@universidadean.edu.co",
                  "VinculacionMiembro": "Estudiante",
                  "RolIniciativa": "Desarrollador",
                  "OrdenMiembro": 1,
                  "EsLider": "Sí",
                  "EsEanista": "Sí",
                  "EsMujer": "No especificado",
                  "EstadoRegistro": "Activo"
            }
      ]
};

    const forceDemo = CONFIG.FORCE_DEMO !== false;
    if (forceDemo) {
      console.info("Science2Venture Hub: usando demo estático basado en Excel. Para usar API real, define FORCE_DEMO:false en config.js.");
      return DEMO_DATA;
    }

    if (!apiUrl) {
      console.warn("Falta configurar la URL HTTP del flujo S2V_02. Cargando modo demo.");
      return DEMO_DATA;
    }

    try {
      const res = await fetch(apiUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          correoEvaluador: session.correoEvaluador,
          codigoAcceso: session.codigoAcceso,
          modo: "consulta"
        })
      });

      const text = await res.text();
      let data = null;

      try {
        data = text ? JSON.parse(text) : null;
      } catch (parseError) {
        console.warn("La API no devolvió JSON válido. Cargando modo demo.", parseError);
        return DEMO_DATA;
      }

      if (!res.ok || data?.ok === false) {
        console.warn("API respondió con error. Cargando modo demo.", res.status, data);
        return DEMO_DATA;
      }

      return data;
    } catch (error) {
      console.warn("No se pudo consultar Power Automate. Cargando modo demo.", error);
      return DEMO_DATA;
    }
  }


  /* ── Auth ── */
  async function login(e) {
    e.preventDefault();
    const correo = clean(els.correoEvaluador.value);
    const codigo = clean(els.codigoAcceso.value);
    const btn = els.loginForm.querySelector("button[type='submit']");
    if (!correo || !codigo) { setMessage("Completa correo y código.", "error"); return; }
    btn.disabled = true;
    btn.classList.add("loading");
    setMessage("Consultando SharePoint…", "");
    try {
      const session = { correoEvaluador: correo, codigoAcceso: codigo };
      const data = await fetchData(session);
      state.session = session;
      localStorage.setItem(STORAGE_KEYS.session, JSON.stringify({ correoEvaluador: correo }));
      loadData(data);
      showDashboard();
      setMessage("", "");
    } catch (err) { setMessage(err.message, "error"); }
    finally { btn.disabled = false; btn.classList.remove("loading"); }
  }

  function showDashboard() {
    els.userEmailLabel.textContent = state.session?.correoEvaluador || "Evaluador";
    els.loginView.classList.add("leaving");
    setTimeout(() => {
      els.loginView.classList.add("hidden");
      els.loginView.classList.remove("leaving");
      els.dashboardView.classList.remove("hidden");
      staggerIn(".metric-card", 70);
    }, 420);
  }

  function showLogin() {
    state.session = null;
    localStorage.removeItem(STORAGE_KEYS.session);
    els.dashboardView.classList.add("hidden");
    els.loginView.classList.remove("hidden");
    resetDetail();
  }

  function resetDetail() {
    els.detailPanel.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon"><svg width="36" height="36" fill="none" viewBox="0 0 36 36"><circle cx="11" cy="11" r="4.5" fill="currentColor" opacity=".7"/><circle cx="25" cy="11" r="4.5" fill="currentColor" opacity=".7"/><circle cx="18" cy="25" r="4.5" fill="currentColor"/><path d="M14 14l4 9m4-9l-4 9" stroke="currentColor" stroke-width="2" opacity=".5"/></svg></div>
        <h3>Selecciona una iniciativa</h3>
        <p>Ficha, documentos, equipo y evaluación.</p>
      </div>`;
  }

  /* ── Data ── */
  function loadData(data) {
    const n = normalizeData(data);
    state.raw = data;
    state.postulaciones = n.postulaciones;
    state.controlDocumental = n.controlDocumental;
    state.miembrosEquipo = n.miembrosEquipo;
    applyFilters();
    renderMetrics();
    renderConvocatoriaSummary();
  }

  function renderMetrics() {
    animateNumber(els.metricPostulaciones, state.postulaciones.length);
    animateNumber(els.metricControl, state.controlDocumental.length);
    animateNumber(els.metricMiembros, state.miembrosEquipo.length);
    animateNumber(els.metricEquidad, state.postulaciones.filter(i => i.BonoEquidadAplica === true || i.BonoEquidad > 0).length);
  }


  /* ── Convocatoria Summary Rendering ── */
  function splitMulti(value) {
    return clean(value).split(";").map(v => v.replace(/\.$/, "").trim()).filter(Boolean);
  }

  function labelShort(value, max = 74) {
    const t = choice(value, "Pendiente").replace(/\s+/g, " ").trim();
    return t.length > max ? t.slice(0, max - 1).trim() + "…" : t;
  }

  function countBy(items, getter, multi = false) {
    const map = new Map();
    for (const item of items) {
      const raw = getter(item);
      const values = multi ? splitMulti(raw) : [choice(raw, "Pendiente")];
      for (const value of values) {
        const key = labelShort(value);
        if (!key) continue;
        map.set(key, (map.get(key) || 0) + 1);
      }
    }
    return Array.from(map.entries()).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], "es"));
  }

  function yes(value) {
    return /^s[ií]/i.test(clean(value));
  }

  function numAvg(items, key) {
    const vals = items.map(i => Number(i[key])).filter(n => Number.isFinite(n) && n > 0);
    if (!vals.length) return "—";
    return (vals.reduce((a, b) => a + b, 0) / vals.length).toFixed(1);
  }

  function percent(value, total) {
    if (!total) return 0;
    return Math.round((value / total) * 100);
  }

  function miniKpi(label, value, note = "") {
    return `<article class="micro-kpi"><strong>${esc(value)}</strong><span>${esc(label)}</span>${note ? `<small>${esc(note)}</small>` : ""}</article>`;
  }

  function barList(title, rows, total, options = {}) {
    const limit = options.limit || 6;
    const empty = `<div class="summary-empty">Sin datos para mostrar.</div>`;
    const shown = rows.slice(0, limit);
    const body = shown.length ? shown.map(([label, count]) => {
      const w = Math.max(6, percent(count, total || state.postulaciones.length || 1));
      return `<div class="summary-bar-row">
        <div class="summary-bar-label"><span>${esc(label)}</span><strong>${count}</strong></div>
        <div class="summary-bar-track"><span style="width:${w}%"></span></div>
      </div>`;
    }).join("") : empty;
    return `<article class="summary-panel ${options.className || ""}">
      <div class="summary-panel-head">
        <h4>${esc(title)}</h4>
        ${options.note ? `<span>${esc(options.note)}</span>` : ""}
      </div>
      ${body}
    </article>`;
  }

  function maturityMatrix() {
    const total = state.postulaciones.length || 1;
    const trl = countBy(state.postulaciones, i => i.TRLDeclarado);
    const crl = countBy(state.postulaciones, i => i.CRLDeclarado);
    const brl = countBy(state.postulaciones, i => i.BRLDeclarado);
    return `<article class="summary-panel maturity-panel">
      <div class="summary-panel-head"><h4>Madurez declarada</h4><span>Promedios TRL ${numAvg(state.postulaciones, "TRLNum")} · CRL ${numAvg(state.postulaciones, "CRLNum")} · BRL ${numAvg(state.postulaciones, "BRLNum")}</span></div>
      <div class="maturity-grid">
        <div>${barList("TRL", trl, total, { limit: 9, className: "nested-panel" })}</div>
        <div>${barList("CRL", crl, total, { limit: 9, className: "nested-panel" })}</div>
        <div>${barList("BRL", brl, total, { limit: 9, className: "nested-panel" })}</div>
      </div>
    </article>`;
  }

  function renderConvocatoriaSummary() {
    if (!els.convocatoriaResumen) return;
    const items = state.postulaciones;
    const total = items.length;
    const conVentas = items.filter(i => yes(i.TieneVentas)).length;
    const conEvidencias = items.filter(i => yes(i.EvidenciasDocumentadas) || clean(i.EvidenciasURL)).length;
    const preparandoEvidencias = items.filter(i => /preparando/i.test(choice(i.EvidenciasDocumentadas, ""))).length;
    const sinEvidencias = items.filter(i => /No cuento/i.test(choice(i.EvidenciasDocumentadas, ""))).length;
    const conVideo = items.filter(i => clean(i.VideoPitchURL)).length;
    const conAnexo = items.filter(i => clean(i.URLAnexo1)).length;
    const buscaInversion = items.filter(i => yes(i.BuscaInversion)).length;
    const conBono = items.filter(i => i.BonoEquidadAplica === true || Number(i.BonoEquidad) > 0).length;
    const impactoMedido = items.filter(i => /medido|pilotos|escenarios controlados/i.test(choice(i.MideImpacto, ""))).length;
    const impactoConMetricas = items.filter(i => !/Todavía no/i.test(choice(i.MideImpacto, ""))).length;

    const routes = countBy(items, i => routeOf(i));
    const areas = countBy(items, i => i.AreaConocimiento);
    const enfoques = countBy(items, i => i.EnfoqueProyecto);
    const tipoTec = countBy(items, i => i.TipoTecnologia);
    const complejidad = countBy(items, i => i.ComplejidadTecnica);
    const verticales = countBy(items, i => i.VerticalSostenibilidad, true);
    const sectores = countBy(items, i => i.SectorProductivo, true);
    const ods = countBy(items, i => i.ODSRelacionados, true);
    const cliente = countBy(items, i => i.TipoClientePrincipal, true);
    const ventas = countBy(items, i => i.TieneVentas);
    const evidencias = countBy(items, i => i.EvidenciasDocumentadas);
    const pi = countBy(items, i => i.EstadoProteccionPI);
    const inversion = countBy(items, i => i.BuscaInversion);

    els.convocatoriaResumen.innerHTML = `
      <div class="summary-hero-panel">
        <div>
          <p class="eyebrow">Paneo general de convocatoria</p>
          <h3>18 postulaciones reales depuradas para demo</h3>
          <p>Resumen estático construido desde el Excel de respuestas. Se excluyeron 5 registros de prueba y se enmascararon correos/enlaces documentales para evitar exposición pública en GitHub Pages.</p>
        </div>
        <div class="summary-hero-kpis">
          ${miniKpi("Con evidencias", `${conEvidencias}/${total}`, `${percent(conEvidencias, total)}%`)}
          ${miniKpi("Con ventas", `${conVentas}/${total}`, `${percent(conVentas, total)}%`)}
          ${miniKpi("Buscan inversión", `${buscaInversion}/${total}`, `${percent(buscaInversion, total)}%`)}
          ${miniKpi("Bono equidad", `${conBono}/${total}`, `${percent(conBono, total)}%`)}
        </div>
      </div>

      <div class="summary-kpi-strip">
        ${miniKpi("Video pitch recibido", `${conVideo}/${total}`)}
        ${miniKpi("Anexo 1 recibido", `${conAnexo}/${total}`)}
        ${miniKpi("Preparando evidencias", preparandoEvidencias)}
        ${miniKpi("Sin evidencias declaradas", sinEvidencias)}
        ${miniKpi("Impacto con métricas", `${impactoConMetricas}/${total}`)}
        ${miniKpi("Impacto medido", `${impactoMedido}/${total}`)}
      </div>

      <div class="summary-insight-grid">
        ${barList("Rutas por TRL", routes, total, { note: "Asignación preliminar por TRL declarado" })}
        ${barList("Áreas de conocimiento", areas, total)}
        ${barList("Verticales de sostenibilidad", verticales, total, { limit: 8 })}
        ${barList("Sectores productivos", sectores, total, { limit: 8 })}
        ${barList("Base / enfoque del proyecto", enfoques, total)}
        ${barList("Tipo de tecnología", tipoTec, total, { limit: 6 })}
        ${barList("Complejidad técnica", complejidad, total)}
        ${barList("Tipo de cliente", cliente, total, { limit: 6 })}
        ${barList("Ventas declaradas", ventas, total)}
        ${barList("Estado de evidencias", evidencias, total)}
        ${barList("Protección de PI", pi, total, { limit: 6 })}
        ${barList("Búsqueda de inversión", inversion, total)}
        ${maturityMatrix()}
        ${barList("ODS más frecuentes", ods, total, { limit: 8, className: "wide-panel" })}
      </div>
    `;
  }


  function animateNumber(el, target) {
    const start = parseInt(el.textContent, 10) || 0;
    if (start === target) { el.textContent = target; return; }
    const duration = 600;
    const t0 = performance.now();
    function tick(now) {
      const p = Math.min((now - t0) / duration, 1);
      const ease = 1 - Math.pow(1 - p, 3);
      el.textContent = Math.round(start + (target - start) * ease);
      if (p < 1) requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);
  }

  /* ── Filters ── */
  function applyFilters() {
    const q = clean(els.searchInput.value).toLowerCase();
    const route = els.routeFilter.value;
    const status = els.statusFilter.value;
    state.filtered = state.postulaciones.filter(item => {
      const h = [initiativeIdOf(item), initiativeNameOf(item), item.NombreLider, item.CorreoLider, item.Ciudad, trlOf(item), routeOf(item), statusOf(item)].join(" ").toLowerCase();
      return (!q || h.includes(q)) && (!route || routeOf(item).includes(route)) && (!status || statusOf(item).includes(status));
    });
    renderInitiativeList();
  }

  function renderInitiativeList() {
    els.initiativeList.innerHTML = "";
    els.visibleCount.textContent = `${state.filtered.length}`;
    if (!state.filtered.length) {
      els.initiativeList.innerHTML = '<div class="alert-box">No hay iniciativas que coincidan con los filtros.</div>';
      return;
    }
    for (const item of state.filtered) {
      const id = initiativeIdOf(item);
      const node = els.cardTemplate.content.cloneNode(true);
      const card = node.querySelector(".initiative-card");
      const button = node.querySelector(".card-button");
      if (state.selectedId === id) card.classList.add("active");
      node.querySelector(".id-label").textContent = id;
      node.querySelector("h4").textContent = initiativeNameOf(item);
      node.querySelector("p").textContent = shortText(item.DescripcionCorta || item.ObservacionesInternas || item.NombreLider);
      node.querySelector(".badge-row").innerHTML = [
        badge(routeOf(item), "cyan"), badge(trlOf(item)), badge(choice(item.CRLDeclarado), "success"), badge(choice(item.BRLDeclarado), "warning"),
        badge(statusOf(item)), item.BonoEquidadAplica ? badge("Bono equidad", "gold") : ""
      ].join("");
      button.addEventListener("click", () => selectInitiative(id));
      els.initiativeList.appendChild(node);
    }
  }

  function badge(text, variant = "") { return `<span class="badge ${variant}">${esc(text)}</span>`; }

  function selectInitiative(id) {
    state.selectedId = id;
    renderInitiativeList();
    renderDetail(id);
  }

  function findControl(id) { return state.controlDocumental.find(i => clean(i.Title || i.IDIniciativa) === id) || null; }
  function findMembers(id) { return state.miembrosEquipo.filter(i => clean(i.IDIniciativa) === id).sort((a, b) => Number(a.OrdenMiembro || 99) - Number(b.OrdenMiembro || 99)); }

  function field(label, value, long = false) {
    return `<div class="field ${long ? "long-field" : ""}"><span class="label">${esc(label)}</span><span class="value">${esc(value ?? "Pendiente")}</span></div>`;
  }

  function memberCard(m) {
    const name = clean(m.Title || m.NombreMiembro || "Integrante sin nombre");
    const parts = [choice(m.VinculacionMiembro, "Vinculación pendiente"), m.RolIniciativa ? clean(m.RolIniciativa) : "Rol pendiente", m.EsLider ? "Líder" : "Integrante", m.EsEanista ? "Eanista" : "No eanista", m.EsMujer ? "Mujer" : ""].filter(Boolean);
    return `<article class="member-card"><strong>${esc(name)}</strong><p>${esc(parts.join(" · "))}</p><p>${esc(clean(m.CorreoMiembro || "Correo pendiente"))}</p></article>`;
  }

  /* ── Detail Rendering ── */
  function renderDetail(id) {
    const item = state.postulaciones.find(r => initiativeIdOf(r) === id);
    if (!item) return;
    const control = findControl(id);
    const members = findMembers(id);
    const evidUrl = clean(item.EvidenciasURL || control?.EvidenciasURL);
    const videoUrl = clean(item.VideoPitchURL || control?.VideoPitchURL);
    const anexoUrl = clean(control?.URLAnexo1 || item.URLAnexo1);

    els.detailPanel.innerHTML = `
      <div class="detail-header">
        <div>
          <p class="eyebrow">${esc(id)}</p>
          <h3>${esc(initiativeNameOf(item))}</h3>
          <div class="badge-row">
            ${badge(routeOf(item), "cyan")} ${badge(trlOf(item))} ${badge(statusOf(item))}
            ${item.BonoEquidadAplica ? badge("Bono equidad", "gold") : badge("Sin bono")}
          </div>
        </div>
        <div class="detail-actions">
          ${evidUrl ? `<a class="detail-link" href="${esc(evidUrl)}" target="_blank" rel="noopener">Evidencias</a>` : ""}
          ${videoUrl ? `<a class="detail-link" href="${esc(videoUrl)}" target="_blank" rel="noopener">Video pitch</a>` : ""}
          ${anexoUrl ? `<a class="detail-link" href="${esc(anexoUrl)}" target="_blank" rel="noopener">Anexo 1</a>` : ""}
        </div>
      </div>

      <section class="detail-section" style="animation-delay:0.05s">
        <h4>Información general</h4>
        <div class="field-grid">
          ${field("Líder", item.NombreLider)} ${field("Correo líder", item.CorreoLider)}
          ${field("Ciudad", item.Ciudad)} ${field("Vinculación", choice(item.VinculacionLider))}
          ${field("Área de conocimiento", choice(item.AreaConocimiento))} ${field("Enfoque", choice(item.EnfoqueProyecto))}
          ${field("Grupo o semillero", item.GrupoOSemillero || choice(item.SurgeGrupoSemillero))}
          ${field("Mujeres en equipo", item.MujeresEquipo ?? "Pendiente")}
          ${field("Descripción", item.DescripcionCorta || "Sin descripción.", true)}
        </div>
      </section>

      <section class="detail-section" style="animation-delay:0.1s">
        <h4>Madurez tecnológica, cliente y negocio</h4>
        <div class="field-grid">
          ${field("TRL declarado", trlOf(item), true)}
          ${field("CRL declarado", choice(item.CRLDeclarado), true)}
          ${field("BRL declarado", choice(item.BRLDeclarado), true)}
          ${field("Ruta TRL preliminar", routeOf(item))}
          ${field("Entorno de prueba", choice(item.EntornoPruebaTecnologia))}
          ${field("Complejidad técnica", choice(item.ComplejidadTecnica))}
          ${field("Tipo de tecnología", choice(item.TipoTecnologia), true)}
          ${field("Origen de tecnología", choice(item.OrigenTecnologia), true)}
          ${field("Brecha técnica principal", choice(item.BrechaTecnicaPrincipal), true)}
          ${field("Coherencia TRL", choice(item.CoherenciaTRLPreliminar))}
          ${field("Postura frente a equity EAN", choice(item.PosturaEquityEan), true)}
        </div>
      </section>

      <section class="detail-section" style="animation-delay:0.13s">
        <h4>Mercado, tracción y ventas</h4>
        <div class="field-grid">
          ${field("Tipo de cliente", choice(item.TipoClientePrincipal))}
          ${field("Alcance geográfico", choice(item.AlcanceGeografico))}
          ${field("Evidencia de interés", item.EvidenciaInteresSolucion || "Sin información", true)}
          ${field("Conocimiento de competencia", choice(item.ConocimientoCompetencia))}
          ${field("Estimación de mercado", choice(item.EstimacionMercado))}
          ${field("Sector productivo", item.SectorProductivo || "Sin información", true)}
          ${field("Modelo de ingresos", choice(item.ModeloIngresos))}
          ${field("Ventas declaradas", choice(item.TieneVentas))}
          ${field("Facturación acumulada", choice(item.FacturacionTotal))}
          ${field("Promedio ventas 3 meses", choice(item.PromedioVentasMensual3M))}
          ${field("Busca inversión", choice(item.BuscaInversion))}
          ${field("Necesidad financiera 12 meses", choice(item.NecesidadFinanciera12Meses))}
        </div>
      </section>

      <section class="detail-section" style="animation-delay:0.16s">
        <h4>Propiedad intelectual, sostenibilidad e impacto</h4>
        <div class="field-grid">
          ${field("Estado PI", choice(item.EstadoProteccionPI), true)}
          ${field("Tipo de protección", item.TipoProteccionPI || "Sin información", true)}
          ${field("Dueño legal PI", choice(item.DuenoLegalPI))}
          ${field("Libertad de operación", choice(item.LibertadOperacion))}
          ${field("Vertical sostenibilidad", item.VerticalSostenibilidad || "Sin información", true)}
          ${field("ODS relacionados", item.ODSRelacionados || "Sin información", true)}
          ${field("Medición de impacto", choice(item.MideImpacto), true)}
          ${field("Regulación requerida", item.RequiereRegulacion || "Sin información", true)}
        </div>
      </section>

      <section class="detail-section" style="animation-delay:0.15s">
        <h4>Control documental</h4>
        ${control ? `<div class="field-grid">
          ${field("Estado general", choice(control.EstadoDocumentalGeneral))}
          ${field("Video pitch", choice(control.VideoPitchEstado))}
          ${field("Evidencias", choice(control.EvidenciasEstado))}
          ${field("Alerta evidencias", boolText(control.EvidenciasAlertaInterna))}
          ${field("Estado Anexo 1", choice(control.EstadoAnexo1 || control.Anexo1Estado))}
          ${field("Método recepción Anexo 1", choice(control.MetodoRecepcionAnexo1))}
          ${field("Acepta términos", choice(control.AceptaTerminos))}
          ${field("Autoriza datos", choice(control.AutorizaDatos))}
          ${field("Declara veracidad", choice(control.DeclaraVeracidad))}
          ${field("Cumple equipo", choice(control.CumpleEquipo))}
          ${field("Cumple habilitantes", choice(control.CumpleHabilitantes))}
          ${field("Requiere subsanación", boolText(control.RequiereSubsanacion))}
          ${field("Observación", control.ObservacionDocumentalGeneral || "Sin observación", true)}
        </div>` : '<div class="alert-box">No hay control documental asociado a esta iniciativa.</div>'}
      </section>

      <section class="detail-section" style="animation-delay:0.2s">
        <h4>Equipo registrado</h4>
        ${members.length ? `<div class="team-list">${members.map(memberCard).join("")}</div>` : '<div class="alert-box">No hay miembros asociados en la respuesta actual.</div>'}
      </section>

      ${renderEvaluation(id)}
    `;
    attachEvalListeners(id);
  }

  /* ── Evaluation ── */
  function getEvalKey(id) { return `s2v_eval_${id}`; }
  function loadEval(id) { try { return JSON.parse(localStorage.getItem(getEvalKey(id))) || {}; } catch { return {}; } }
  function saveEval(id, data) { localStorage.setItem(getEvalKey(id), JSON.stringify(data)); }

  function renderEvaluation(id) {
    const saved = loadEval(id);
    const total = EVAL_CRITERIA.reduce((s, c) => s + (saved[c.key] || 0), 0);
    const offset = RING_CIRCUMFERENCE * (1 - total / 1000);
    const ringColor = total < 400 ? "#ef6b6b" : total < 700 ? "#f0c85c" : "#55c9cc";

    let criteriaHtml = "";
    for (const c of EVAL_CRITERIA) {
      const val = saved[c.key] || 0;
      const pct = ((val / c.max) * 100).toFixed(1);
      const bg = `linear-gradient(to right, ${c.color} 0%, ${c.color} ${pct}%, rgba(255,255,255,0.06) ${pct}%)`;
      criteriaHtml += `
        <div class="criterion" data-key="${c.key}" data-max="${c.max}">
          <div class="criterion-head">
            <span class="criterion-name">${c.label}</span>
            <span class="criterion-value"><strong>${val}</strong> / ${c.max}</span>
          </div>
          <input type="range" min="0" max="${c.max}" step="5" value="${val}"
                 data-key="${c.key}" data-color="${c.color}" style="background:${bg}">
        </div>`;
    }

    return `
      <section class="detail-section eval-section" style="animation-delay:0.25s">
        <div class="eval-header">
          <h4>Evaluación del panel</h4>
          <div class="score-ring-wrap">
            <svg class="score-ring" viewBox="0 0 120 120">
              <circle class="score-ring-bg" cx="60" cy="60" r="52"/>
              <circle class="score-ring-fill" cx="60" cy="60" r="52"
                stroke-dasharray="${RING_CIRCUMFERENCE}" stroke-dashoffset="${offset}"
                style="stroke:${ringColor}" id="evalRingFill"/>
            </svg>
            <div class="score-ring-text">
              <strong id="evalTotal">${total}</strong>
              <span>/ 1000</span>
            </div>
          </div>
        </div>
        <div class="eval-criteria">${criteriaHtml}</div>
        <label class="eval-notes-label">
          <span>Observaciones del evaluador</span>
          <textarea id="evalNotes" rows="3" placeholder="Notas adicionales…">${esc(saved.observaciones || "")}</textarea>
        </label>
        <div class="eval-actions">
          <button class="secondary-btn" id="evalResetBtn" type="button">Limpiar</button>
          <button class="primary-btn" id="evalSaveBtn" type="button">
            <span>Guardar evaluación</span>
            <svg width="18" height="18" fill="none" viewBox="0 0 18 18"><path d="M3.75 9h10.5M9.75 4.5 14.25 9l-4.5 4.5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>
          </button>
        </div>
        <div id="evalFeedback"></div>
      </section>`;
  }

  function attachEvalListeners(initiativeId) {
    const sliders = $$(".eval-section input[type='range']");
    if (!sliders.length) return;

    function updateUI() {
      let total = 0;
      for (const s of sliders) {
        const val = parseInt(s.value, 10);
        const max = parseInt(s.closest(".criterion").dataset.max, 10);
        const color = s.dataset.color;
        const pct = ((val / max) * 100).toFixed(1);
        s.style.background = `linear-gradient(to right, ${color} 0%, ${color} ${pct}%, rgba(255,255,255,0.06) ${pct}%)`;
        const head = s.closest(".criterion").querySelector(".criterion-value strong");
        if (head) head.textContent = val;
        total += val;
      }
      const totalEl = $("#evalTotal");
      const ringEl = $("#evalRingFill");
      if (totalEl) totalEl.textContent = total;
      if (ringEl) {
        ringEl.style.strokeDashoffset = RING_CIRCUMFERENCE * (1 - total / 1000);
        ringEl.style.stroke = total < 400 ? "#ef6b6b" : total < 700 ? "#f0c85c" : "#55c9cc";
      }
    }

    sliders.forEach(s => s.addEventListener("input", updateUI));

    const saveBtn = $("#evalSaveBtn");
    const resetBtn = $("#evalResetBtn");
    const notesEl = $("#evalNotes");
    const feedbackEl = $("#evalFeedback");

    if (saveBtn) saveBtn.addEventListener("click", () => {
      const evaluation = {};
      sliders.forEach(s => { evaluation[s.dataset.key] = parseInt(s.value, 10); });
      evaluation.observaciones = notesEl ? notesEl.value : "";
      evaluation.timestamp = new Date().toISOString();
      evaluation.evaluador = state.session?.correoEvaluador || "";
      saveEval(initiativeId, evaluation);
      if (feedbackEl) {
        feedbackEl.innerHTML = '<div class="eval-saved-msg">✓ Evaluación guardada localmente</div>';
        setTimeout(() => { feedbackEl.innerHTML = ""; }, 3000);
      }
    });

    if (resetBtn) resetBtn.addEventListener("click", () => {
      sliders.forEach(s => { s.value = 0; });
      if (notesEl) notesEl.value = "";
      updateUI();
      if (feedbackEl) feedbackEl.innerHTML = "";
    });
  }

  /* ── Animation Helpers ── */
  function staggerIn(selector, delay = 50) {
    const items = $$(selector);
    items.forEach((el, i) => {
      el.style.opacity = "0";
      el.style.transform = "translateY(14px)";
      setTimeout(() => {
        el.style.transition = "opacity 0.45s cubic-bezier(0.16,1,0.3,1), transform 0.45s cubic-bezier(0.16,1,0.3,1)";
        el.style.opacity = "1";
        el.style.transform = "translateY(0)";
      }, i * delay + 30);
    });
  }

  /* ── Reload & URL ── */
  async function reloadData() {
    if (!state.session) return;
    els.reloadBtn.disabled = true;
    els.reloadBtn.textContent = "Actualizando…";
    try {
      const data = await fetchData(state.session);
      loadData(data);
      if (state.selectedId) renderDetail(state.selectedId);
    } catch (err) { alert(err.message); }
    finally { els.reloadBtn.disabled = false; els.reloadBtn.textContent = "Actualizar"; }
  }

  function saveApiUrl() {
    const url = clean(els.apiUrlInput.value);
    if (!url.startsWith("https://")) { setMessage("La URL debe empezar por https://", "error"); return; }
    localStorage.setItem(STORAGE_KEYS.apiUrl, url);
    setMessage("URL guardada localmente.", "success");
  }

  /* ── Init ── */
  function init() {
    const storedUrl = localStorage.getItem(STORAGE_KEYS.apiUrl);
    if (storedUrl && els.apiUrlInput) els.apiUrlInput.value = storedUrl;
    if (!getConfiguredApiUrl() && els.setupPanel) els.setupPanel.open = true;

    const storedSession = localStorage.getItem(STORAGE_KEYS.session);
    if (storedSession) {
      try { const p = JSON.parse(storedSession); if (p?.correoEvaluador) els.correoEvaluador.value = p.correoEvaluador; } catch {}
    }
    if (CONFIG.CODIGO_DEMO) els.codigoAcceso.placeholder = CONFIG.CODIGO_DEMO;

    els.loginForm.addEventListener("submit", login);
    if (els.saveApiUrlBtn) els.saveApiUrlBtn.addEventListener("click", saveApiUrl);
    els.logoutBtn.addEventListener("click", showLogin);
    els.reloadBtn.addEventListener("click", reloadData);
    els.searchInput.addEventListener("input", applyFilters);
    els.routeFilter.addEventListener("change", applyFilters);
    els.statusFilter.addEventListener("change", applyFilters);
  }

  document.addEventListener("DOMContentLoaded", init);
})();
