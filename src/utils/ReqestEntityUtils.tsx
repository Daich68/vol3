export type ID = string | null;

interface FetchOptions {
    method: string;
    headers?: Record<string, string>;
    body?: string;
}

async function apiRequest<T>(url: string, options: FetchOptions): Promise<T> {
    const response = await fetch(url, options);
    if (!response.ok) {
        throw new Error(response.statusText);
    }
    const text = await response.text();
    // Verify if response is empty. If so, return empty array/object to prevent crash.
    // Most getters return arrays, so [] is a safe fallback.
    return text ? JSON.parse(text) : ([] as unknown as T);
}

async function apiRequestWithoutResponseBody(url: string, options: FetchOptions): Promise<string> {
    const response = await fetch(url, options);
    return response.statusText;
}

export function getEntity<T>(url: string, id: ID | null = null): Promise<T> {
    const finalUrl = id ? `${url}?id=${id}` : url;
    return apiRequest<T>(finalUrl, {
        method: 'GET',
        headers: {
            'Content-Type': 'application/json'
        }
    });
}

export function getEntityWithQueryParams<T>(url: string, params: Record<string, any>): Promise<T> {
    const queryString = new URLSearchParams(params as Record<string, string>).toString();
    const finalUrl = queryString ? `${url}?${queryString}` : url;

    return apiRequest<T>(finalUrl, {
        method: 'GET',
        headers: {
            'Content-Type': 'application/json',
        },
    });
}


interface Id {
    _id?: string
}

export function editEntity<T extends Id>(url: string, data: T): Promise<any> {
    if (data._id === "") {
        data._id = undefined
    }
    return apiRequest<T>(url, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': localStorage.getItem('accessToken') || ""
        },
        body: JSON.stringify(data)
    });
}

export function getEntityWithParams<T, A>(url: string, data: A): Promise<T> {
    return apiRequest<T>(url, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': localStorage.getItem('accessToken') || ""
        },
        body: JSON.stringify(data)
    });
}

export function deleteEntity(url: string, id: string) {
    return apiRequestWithoutResponseBody(`${url}/${id}`, {
        method: 'DELETE',
        headers: {
            'Authorization': localStorage.getItem('accessToken') || ""
        },
    });
}
