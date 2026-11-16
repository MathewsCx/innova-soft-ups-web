<script setup>
import { computed, onMounted, onUnmounted, ref } from "vue";
import TaskCard from "./components/TaskCard.vue";
import TaskFilters from "./components/TaskFilters.vue";
import TaskForm from "./components/TaskForm.vue";
import StatePanel from "./components/StatePanel.vue";
import { ApiError, createTaskApi } from "./services/task-api.js";

const api = createTaskApi(import.meta.env.VITE_API_BASE_URL || "/api");
const tasks = ref([]);
const listState = ref("loading");
const loadError = ref("");
const formError = ref("");
const feedback = ref("");
const selectedState = ref("");
const search = ref("");
const editingTask = ref(null);
const formRevision = ref(0);
const mutationPending = ref(false);
let activeRequest;
let requestSequence = 0;

const visibleTasks = computed(() => {
    const query = search.value.trim().toLocaleLowerCase("es");
    if (!query) {
        return tasks.value;
    }
    return tasks.value.filter((task) =>
        `${task.titulo} ${task.descripcion}`.toLocaleLowerCase("es").includes(query)
    );
});
const completedCount = computed(() =>
    tasks.value.filter((task) => task.estado === "completado").length
);
const progress = computed(() => tasks.value.length
    ? Math.round((completedCount.value / tasks.value.length) * 100)
    : 0);

function errorText(error) {
    if (error instanceof ApiError) {
        return error.message;
    }
    return "Ocurrió un problema inesperado. Inténtalo nuevamente.";
}

async function loadTasks() {
    const sequence = ++requestSequence;
    activeRequest?.abort();
    activeRequest = new AbortController();
    listState.value = "loading";
    loadError.value = "";

    try {
        const result = await api.list({
            estado: selectedState.value || undefined,
            signal: activeRequest.signal
        });
        if (sequence !== requestSequence) {
            return;
        }
        tasks.value = result;
        listState.value = result.length ? "success" : "empty";
    } catch (error) {
        if (error.name === "AbortError" || sequence !== requestSequence) {
            return;
        }
        listState.value = "error";
        loadError.value = errorText(error);
    }
}

async function saveTask(payload) {
    if (mutationPending.value) {
        return;
    }

    mutationPending.value = true;
    formError.value = "";
    feedback.value = "";

    try {
        if (editingTask.value) {
            await api.update({ ...editingTask.value, ...payload });
            feedback.value = "Los cambios se guardaron correctamente.";
        } else {
            await api.create(payload);
            feedback.value = "La nueva tarea se creó correctamente.";
        }
        editingTask.value = null;
        formRevision.value += 1;
        formError.value = "";
        selectedState.value = "";
        await loadTasks();
    } catch (error) {
        formError.value = errorText(error);
    } finally {
        mutationPending.value = false;
    }
}

async function updateTask(task, changes, message) {
    if (mutationPending.value) {
        return;
    }
    mutationPending.value = true;
    feedback.value = "";
    loadError.value = "";

    try {
        await api.update({ ...task, ...changes });
        feedback.value = message;
        selectedState.value = "";
        await loadTasks();
    } catch (error) {
        loadError.value = errorText(error);
        if (error instanceof ApiError && error.status === 409) {
            await loadTasks();
            loadError.value = errorText(error);
        }
    } finally {
        mutationPending.value = false;
    }
}

async function archiveTask(task) {
    if (mutationPending.value) {
        return;
    }
    mutationPending.value = true;
    feedback.value = "";
    loadError.value = "";

    try {
        await api.archive(task.id);
        feedback.value = "La tarea se archivó correctamente.";
        await loadTasks();
    } catch (error) {
        loadError.value = errorText(error);
    } finally {
        mutationPending.value = false;
    }
}

async function removeTask(task) {
    if (mutationPending.value
        || !window.confirm(`¿Eliminar de forma permanente «${task.titulo}»?`)) {
        return;
    }
    mutationPending.value = true;
    feedback.value = "";
    loadError.value = "";

    try {
        await api.remove(task.id);
        feedback.value = "La tarea se eliminó correctamente.";
        await loadTasks();
    } catch (error) {
        loadError.value = errorText(error);
    } finally {
        mutationPending.value = false;
    }
}

function changeFilter(value) {
    selectedState.value = value;
    loadTasks();
}

onMounted(loadTasks);
onUnmounted(() => {
    requestSequence += 1;
    activeRequest?.abort();
});
</script>

<template>
    <header class="app-header">
        <div class="page-width header-inner">
            <a class="brand" href="../" aria-label="InnovaSoft UPS, sitio principal">
                <span class="brand-mark" aria-hidden="true">I</span>
                <span>Innova<span class="brand-light">Soft</span><small>UPS · GESTOR ACADÉMICO</small></span>
            </a>
            <a class="back-link" href="../">Volver al sitio <span aria-hidden="true">↗</span></a>
        </div>
    </header>

    <main id="contenido" class="page-width app-main">
        <section class="intro" aria-labelledby="page-title">
            <div class="intro-copy">
                <p class="eyebrow eyebrow-dark"><span></span> PROYECTOS ACADÉMICOS · 2026</p>
                <h1 id="page-title">Las ideas avanzan<br>cuando <em>se organizan.</em></h1>
                <p class="intro-text">Un espacio sencillo para priorizar actividades, seguir su avance y construir en equipo.</p>
            </div>
            <div class="progress-card" aria-label="Avance de las tareas visibles">
                <span class="progress-label">{{ selectedState ? "AVANCE DEL FILTRO" : "AVANCE GENERAL" }}</span>
                <strong>{{ progress }}<span>%</span></strong>
                <div
                    class="progress-track"
                    role="progressbar"
                    :aria-valuenow="progress"
                    aria-valuemin="0"
                    aria-valuemax="100"
                    :aria-label="`${progress}% de tareas completadas`"
                >
                    <span :style="{ width: `${progress}%` }"></span>
                </div>
                <span class="progress-caption">{{ completedCount }} de {{ tasks.length }} tareas completadas</span>
            </div>
        </section>

        <p v-if="feedback" class="feedback" role="status">{{ feedback }}</p>

        <section class="workspace" aria-label="Gestión de tareas">
            <aside class="form-column" aria-label="Formulario de tarea">
                <TaskForm
                    :key="formRevision"
                    :task="editingTask"
                    :pending="mutationPending"
                    :error="formError"
                    @submit="saveTask"
                    @cancel="editingTask = null; formError = ''"
                />
                <div class="offline-note">
                    <span class="offline-indicator" aria-hidden="true"></span>
                    <p>Las tareas se consultan desde la API. Sin conexión, puedes volver a abrir la interfaz, pero los datos no se guardan localmente.</p>
                </div>
            </aside>

            <section class="task-section" aria-labelledby="tasks-heading">
                <div class="tasks-heading">
                    <div>
                        <p class="eyebrow eyebrow-dark">TABLERO DE TRABAJO</p>
                        <h2 id="tasks-heading">Tareas <span>{{ tasks.length }}</span></h2>
                    </div>
                    <p class="tasks-caption">Organiza el siguiente paso de tu equipo.</p>
                </div>

                <TaskFilters
                    v-model="selectedState"
                    v-model:search="search"
                    @update:model-value="changeFilter"
                    @refresh="loadTasks"
                />

                <p v-if="loadError && listState !== 'error'" class="inline-error" role="alert">
                    {{ loadError }}
                </p>

                <StatePanel
                    v-if="listState === 'loading' || listState === 'empty' || listState === 'error'"
                    :kind="listState"
                    :message="loadError"
                    @retry="loadTasks"
                />
                <div v-else-if="visibleTasks.length" class="task-list" aria-live="polite">
                    <TaskCard
                        v-for="task in visibleTasks"
                        :key="task.id"
                        :task="task"
                        :pending="mutationPending"
                        @edit="editingTask = $event; formError = ''"
                        @change-state="(item, state) => updateTask(item, { estado: state }, 'El estado de la tarea se actualizó.')"
                        @archive="archiveTask"
                        @remove="removeTask"
                    />
                </div>
                <div v-else class="search-empty" role="status">
                    <h3>No encontramos coincidencias</h3>
                    <p>Prueba con otro término o limpia el campo de búsqueda.</p>
                </div>
            </section>
        </section>
    </main>

    <footer class="app-footer">
        <div class="page-width footer-inner">
            <span>InnovaSoft UPS</span>
            <span>Aplicaciones Web · Unidad 3</span>
            <a href="#contenido">Volver arriba ↑</a>
        </div>
    </footer>
</template>
