/**
 * DataViewContext — global workspace switcher.
 *
 * viewMode: 'both'     → show shared group data + personal data
 *           'team'     → show only shared group data
 *           'personal' → show only the caller's own private records
 *
 * Only meaningful when the user is a member of a group.
 * When the user has no group, all modes behave identically (personal data only).
 */
import { createContext, useContext, useState, useEffect, useCallback } from 'react'

const DataViewContext = createContext({
    viewMode: 'both',
    setViewMode: () => {},
    hasGroup: false,
    groupName: null,
    viewParamAmp: '',   // variant to append to URLs that already have '?': '&view=MODE' or ''
    groupRole: null,
    isContextualAdmin: true, // Default to true until proven otherwise
})

export function DataViewProvider({ children }) {
    const [viewMode, setViewModeState] = useState(
        () => localStorage.getItem('autoMITRE_viewMode') || 'both'
    )
    // Seed from cache so the switcher renders immediately on reload
    const [hasGroup, setHasGroup] = useState(
        () => localStorage.getItem('autoMITRE_hasGroup') === 'true'
    )
    const [groupName, setGroupName] = useState(
        () => localStorage.getItem('autoMITRE_groupName') || null
    )
    const [groupRole, setGroupRole] = useState(
        () => localStorage.getItem('autoMITRE_groupRole') || null
    )
    const [groupLoaded, setGroupLoaded] = useState(false)

    // Fast check: does the user belong to a group?
    const checkGroup = useCallback(async () => {
        const token = localStorage.getItem('token')
        if (!token) { setGroupLoaded(true); return }
        try {
            const res = await fetch('http://localhost:8000/api/groups/mine', {
                headers: { Authorization: `Bearer ${token}` },
            })
            if (res.ok) {
                const data = await res.json()
                const g = !!data.group
                const n = data.group?.name || null
                const r = data.my_role || null
                setHasGroup(g)
                setGroupName(n)
                setGroupRole(r)
                // Cache in localStorage so next load is instant
                localStorage.setItem('autoMITRE_hasGroup', String(g))
                localStorage.setItem('autoMITRE_groupName', n || '')
                localStorage.setItem('autoMITRE_groupRole', r || '')
            }
        } catch { /* offline / not logged in */ }
        setGroupLoaded(true)
    }, [])

    useEffect(() => {
        checkGroup()
        // Re-check every 60s in case user joins or leaves a group
        const t = setInterval(checkGroup, 60_000)
        return () => clearInterval(t)
    }, [checkGroup])

    const setViewMode = (mode) => {
        setViewModeState(mode)
        localStorage.setItem('autoMITRE_viewMode', mode)
    }

    // If user has no group, always use 'both' mode (safest default)
    const effectiveMode = hasGroup ? viewMode : 'both'
    const viewParam = `?view=${effectiveMode}`
    const viewParamAmp = `&view=${effectiveMode}`

    // In 'personal' mode (or if no group exists), everyone acts as an admin of their own sandbox.
    // In 'team' or 'both' mode within a group, you must strictly hold the 'admin' role.
    const isContextualAdmin = !hasGroup || effectiveMode === 'personal' || groupRole === 'admin'

    return (
        <DataViewContext.Provider value={{
            viewMode: effectiveMode,
            setViewMode,
            hasGroup,
            groupName,
            groupRole,
            groupLoaded,
            viewParam,
            viewParamAmp,
            isContextualAdmin,
            refreshGroup: checkGroup,
        }}>
            {children}
        </DataViewContext.Provider>
    )
}

export function useDataView() {
    return useContext(DataViewContext)
}
